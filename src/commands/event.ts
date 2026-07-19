/**
 * « Style Party » — /event start|stop|status (proposition ReNamioos, axe metier, L).
 *
 * Un admin (Manage Server) programme une periode pendant laquelle les membres d'un role (hors
 * opt-out) sont stylises dans un theme, avec REVERT AUTO a la fin. Réutilise le round-trip
 * complet deja en place :
 *  - OriginalNickStore.rememberWithDeadline / forget (echeance) + job sweep-temporaire (revert
 *    massif automatique a l'echeance) ;
 *  - appliquerRename / restaurerPseudo (hierarchie + domaine + troncature + edit) ;
 *  - OptOutStore (consentement STRICTEMENT respecte) ;
 *  - parserEcheance (rename-temporaire) pour la duree.
 *
 * CONTRAINTES honorees : file a DEBIT BORNE pour member.edit en masse (traiterEnFile, JAMAIS
 * Promise.all — rate-limit Discord) ; membres non manageables ignores ; opt-out exclu ; DEUX
 * events simultanes interdits (invariant d'agrégat, porte par EventStore). L'ORCHESTRATION est
 * pure vis-a-vis de discord.js (testee avec des membres factices) ; la commande n'est que le
 * cablage (parse options, fetch des membres du role, embeds themes).
 */
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { Command } from "./types";
import { appliquerRename, capitaliser, estStyleConnu, messageErreur, restaurerPseudo, sourceRename } from "./styliser";
import { autocompleteStyle } from "./style-autocomplete";
import { resoudreContexteCommande } from "./contexte";
import { estMembreStylisable, type EvenementStyle } from "../domain/evenement-style";
import { parserEcheance } from "../domain/rename-temporaire";
import type { StyleName } from "../domain/styles";
import { traiterEnFile } from "../limitation/file-debit";
import { localisations } from "../i18n/localizations";
import { CATALOGUE } from "../i18n/catalog";
import type { EventStore } from "../event/store";
import type { OptOutStore } from "../optout/store";
import type { OriginalNickStore } from "../original-nick/store";
import type { GuildSettingsStore } from "../guildsettings/store";
import type { EmbedTheme } from "../theming/embed";

/** Dependances de l'orchestration (stores + reglage de debit). Testable sans discord.js. */
export interface DepsEvent {
  eventStore: EventStore;
  optOutStore: OptOutStore;
  originalNickStore: OriginalNickStore;
  /** Delai (ms) entre deux member.edit (espace le debit). Defaut : 0 (sequentiel suffit). */
  delaiEditMs?: number;
  /** Attente injectable (tests). Defaut : setTimeout via traiterEnFile. */
  attendre?: (ms: number) => Promise<void>;
}

/** Bilan d'un demarrage : combien stylises, ignores (bot/hierarchie/opt-out), en echec. */
export interface ResumeEvenement {
  stylises: number;
  ignores: number;
  echecs: number;
}

export type ResultatDemarrage =
  | { ok: true; event: EvenementStyle; resume: ResumeEvenement }
  | { ok: false; raison: "deja-en-cours" };

/** Options de file communes (debit borne, jamais Promise.all). */
function optionsFile(deps: DepsEvent) {
  return deps.attendre !== undefined
    ? { delaiMs: deps.delaiEditMs ?? 0, attendre: deps.attendre }
    : { delaiMs: deps.delaiEditMs ?? 0 };
}

/**
 * Demarre une Style Party : verifie l'invariant (un seul event actif), persiste l'event, puis
 * stylise les membres ELIGIBLES en file a debit borne, en memorisant l'echeance de chacun (revert
 * auto via sweep-temporaire). Renvoie `deja-en-cours` si un event est deja actif.
 */
export async function demarrerEvenement(
  deps: DepsEvent,
  params: {
    guildId: string;
    roleId: string;
    style: StyleName;
    startedAt: number;
    expiresAt: number;
    membres: readonly GuildMember[];
  },
): Promise<ResultatDemarrage> {
  const event: EvenementStyle = {
    guildId: params.guildId,
    roleId: params.roleId,
    style: params.style,
    startedAt: params.startedAt,
    expiresAt: params.expiresAt,
  };
  // Invariant d'agrégat : demarrer echoue si un event est deja actif (source unique = store).
  const demarre = await deps.eventStore.demarrer(event, params.startedAt);
  if (!demarre) return { ok: false, raison: "deja-en-cours" };

  const resume: ResumeEvenement = { stylises: 0, ignores: 0, echecs: 0 };
  await traiterEnFile(
    params.membres,
    async (membre) => {
      const estOptOut = await deps.optOutStore.isOptOut(params.guildId, membre.id);
      if (!estMembreStylisable({ estBot: membre.user.bot, manageable: membre.manageable, estOptOut })) {
        resume.ignores += 1;
        return;
      }
      const source = sourceRename(membre, null);
      // Memorise l'echeance AVANT de styliser : le sweep-temporaire reverte a l'expiration.
      const cree = await deps.originalNickStore.rememberWithDeadline(
        params.guildId,
        membre.id,
        source,
        params.expiresAt,
      );
      const resultat = await appliquerRename(membre, params.style, source);
      if (resultat.ok) {
        resume.stylises += 1;
      } else {
        resume.echecs += 1;
        // Le rename a echoue : on n'oublie que la ligne qu'on vient de creer (jamais un original preexistant).
        if (cree) await deps.originalNickStore.forget(params.guildId, membre.id);
      }
    },
    optionsFile(deps),
  );

  return { ok: true, event, resume };
}

export type ResultatArret = { ok: true; event: EvenementStyle; reverts: number } | { ok: false };

/**
 * Arrete une Style Party : supprime l'event et RESTAURE immediatement les pseudos memorises des
 * membres fournis (file a debit borne), oubliant chaque ligne restauree (minimisation D8). Les
 * membres partis du role entre-temps sont rattrapes par le sweep-temporaire a l'echeance.
 */
export async function arreterEvenement(
  deps: DepsEvent,
  params: { guildId: string; membres: readonly GuildMember[] },
): Promise<ResultatArret> {
  const event = await deps.eventStore.arreter(params.guildId);
  if (event === null) return { ok: false };

  let reverts = 0;
  await traiterEnFile(
    params.membres,
    async (membre) => {
      const origine = await deps.originalNickStore.get(params.guildId, membre.id);
      if (origine === null) return; // pas stylise par l'event : rien a restaurer.
      const resultat = await restaurerPseudo(membre, origine);
      if (resultat.ok) {
        await deps.originalNickStore.forget(params.guildId, membre.id);
        reverts += 1;
      }
    },
    optionsFile(deps),
  );

  return { ok: true, event, reverts };
}

/** Membres de la guilde portant le role donne (frontiere Discord -> primitives). */
async function membresDuRole(
  interaction: ChatInputCommandInteraction,
  roleId: string,
): Promise<GuildMember[]> {
  if (!interaction.guild) return [];
  const tous = await interaction.guild.members.fetch();
  return [...tous.values()].filter((m) => m.roles.cache.has(roleId));
}

/** Tag Discord de temps relatif (<t:epoch:R>) pour l'echeance (auto-anime, agnostique locale). */
function tagFin(expiresAt: number): string {
  return `<t:${Math.floor(expiresAt / 1000)}:R>`;
}

/** Fabrique /event : orchestration + socle (reglages + fabrique d'embeds themee). */
export function creerEventCommand(
  deps: DepsEvent,
  settingsStore: GuildSettingsStore,
  embedFactory: EmbedTheme,
): Command {
  const m = CATALOGUE.fr;
  return {
    data: new SlashCommandBuilder()
      .setName("event")
      .setDescription(m.event.commandeDescription)
      .setDescriptionLocalizations(localisations((x) => x.event.commandeDescription))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sc) =>
        sc
          .setName("start")
          .setDescription(m.event.startDescription)
          .setDescriptionLocalizations(localisations((x) => x.event.startDescription))
          .addStringOption((o) =>
            o
              .setName("style")
              .setDescription(m.event.styleOption)
              .setDescriptionLocalizations(localisations((x) => x.event.styleOption))
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((o) =>
            o
              .setName("duree")
              .setDescription(m.event.dureeOption)
              .setDescriptionLocalizations(localisations((x) => x.event.dureeOption))
              .setRequired(true),
          )
          .addRoleOption((o) =>
            o
              .setName("role")
              .setDescription(m.event.roleOption)
              .setDescriptionLocalizations(localisations((x) => x.event.roleOption))
              .setRequired(true),
          ),
      )
      .addSubcommand((sc) =>
        sc
          .setName("stop")
          .setDescription(m.event.stopDescription)
          .setDescriptionLocalizations(localisations((x) => x.event.stopDescription)),
      )
      .addSubcommand((sc) =>
        sc
          .setName("status")
          .setDescription(m.event.statusDescription)
          .setDescriptionLocalizations(localisations((x) => x.event.statusDescription)),
      ),

    autocomplete: autocompleteStyle,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const { messages, settings } = await resoudreContexteCommande(interaction, settingsStore);
      const guildId = interaction.guildId;
      if (guildId === null || !interaction.guild) {
        await interaction.reply({ content: messages.config.horsServeur, ephemeral: true });
        return;
      }
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: messages.config.permissionRefusee, ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const maintenant = Date.now();

      if (sub === "status") {
        const actif = await deps.eventStore.getActif(guildId, maintenant);
        if (actif === null) {
          await interaction.reply({ content: messages.event.aucunEvent, ephemeral: true });
          return;
        }
        const embed = embedFactory({ couleurGuilde: settings.embedColor })
          .setTitle(messages.event.statutTitre)
          .setDescription(
            messages.event.statut({
              style: capitaliser(actif.style),
              roleId: actif.roleId,
              fin: tagFin(actif.expiresAt),
            }),
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (sub === "stop") {
        const actif = await deps.eventStore.getActif(guildId, maintenant);
        if (actif === null) {
          await interaction.reply({ content: messages.event.aucunEvent, ephemeral: true });
          return;
        }
        await interaction.deferReply();
        const membres = await membresDuRole(interaction, actif.roleId);
        const res = await arreterEvenement(deps, { guildId, membres });
        await interaction.editReply({
          content: messages.event.arrete({ reverts: res.ok ? res.reverts : 0 }),
        });
        return;
      }

      // sub === 'start'
      const style = interaction.options.getString("style", true);
      if (!estStyleConnu(style)) {
        await interaction.reply({
          content: messageErreur("style-inconnu", style, messages.styliser),
          ephemeral: true,
        });
        return;
      }
      const echeance = parserEcheance(interaction.options.getString("duree", true), maintenant);
      if (!echeance.ok) {
        await interaction.reply({ content: messages.event.dureeInvalide, ephemeral: true });
        return;
      }
      // Court-circuit UX : refuse tot si un event est deja actif (avant tout fetch de membres).
      if ((await deps.eventStore.getActif(guildId, maintenant)) !== null) {
        await interaction.reply({ content: messages.event.dejaEnCours, ephemeral: true });
        return;
      }

      const role = interaction.options.getRole("role", true);
      await interaction.deferReply();
      const membres = await membresDuRole(interaction, role.id);
      const res = await demarrerEvenement(deps, {
        guildId,
        roleId: role.id,
        style,
        startedAt: maintenant,
        expiresAt: echeance.expiresAt,
        membres,
      });
      if (!res.ok) {
        await interaction.editReply({ content: messages.event.dejaEnCours });
        return;
      }
      const embed = embedFactory({ couleurGuilde: settings.embedColor })
        .setTitle(messages.event.annonceTitre)
        .setDescription(
          messages.event.annonceDescription({
            style: capitaliser(style),
            roleId: role.id,
            fin: tagFin(echeance.expiresAt),
          }),
        )
        .addFields({ name: "📊", value: messages.event.resume(res.resume) });
      await interaction.editReply({ embeds: [embed] });
    },
  };
}
