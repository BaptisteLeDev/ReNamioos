/**
 * Commande /rename <membre> <style> [nouveau_nom] [duree] — renomme un membre stylise.
 *
 * Successeur de rename_slash (bot.py:282). Adapter : verifie la permission Manage
 * Nicknames de l'APPELANT, resout la source (nouveau_nom sinon nick||name),
 * delegue au flux partage appliquerRename (domaine + troncature + edit). Toutes
 * les erreurs (permission, style inconnu, refus propre, hierarchie, Forbidden
 * bot) repondent en ephemere sans renommage — ÉCART VOLONTAIRE B4 (ADR-0003 d.3).
 *
 * RENOMMAGE TEMPORAIRE (issue #38) : option `duree` optionnelle (`2h`, `30m`, `7j` ou
 * date ISO). Fournie => on MEMORISE le pseudo SOURCE avec une echeance (reutilise la
 * persistance #25, port OriginalNickStore) AVANT de styliser ; un job de balayage
 * (src/jobs/sweep-temporaire) restaure le pseudo a l'echeance. Absente => renommage
 * permanent classique (aucune echeance memorisee).
 */
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { Command } from "./types";
import { COULEUR_VERT } from "./couleurs";
import { autocompleteStyle } from "./style-autocomplete";
import {
  appliquerRename,
  embedRenameOk,
  estStyleConnu,
  messageErreur,
  sourceRename,
} from "./styliser";
import { parserEcheance } from "../domain/rename-temporaire";
import type { OriginalNickStore } from "../original-nick/store";
import { creerCompteurFenetre, type CompteurFenetre } from "../limitation/compteur-fenetre";
import {
  FENETRE_RENOMMAGE_MS,
  LIMITE_RENOMMAGE_PAR_INVOCATEUR,
} from "../domain/fenetre-glissante";
import { consommerCooldownOuMessage } from "./cooldown-rename";
import { resoudreContexteCommande } from "./contexte";
import { localisations } from "../i18n/localizations";
import { CATALOGUE } from "../i18n/catalog";
import type { GuildSettingsStore } from "../guildsettings/store";
import { creerMemoryGuildSettingsStore } from "../guildsettings/memory-store";

/**
 * Compteur de cooldown par DÉFAUT (B1) quand la composition n'en injecte pas : chaque
 * fabrique reçoit alors le sien. En prod, src/client.ts injecte UN compteur PARTAGÉ
 * entre /rename et /random pour que la limite de 3/60 s couvre les deux commandes.
 */
function cooldownParDefaut(): CompteurFenetre {
  return creerCompteurFenetre({
    limite: LIMITE_RENOMMAGE_PAR_INVOCATEUR,
    fenetreMs: FENETRE_RENOMMAGE_MS,
  });
}

export function creerRenameCommand(
  originalNickStore: OriginalNickStore,
  cooldown: CompteurFenetre = cooldownParDefaut(),
  settingsStore: GuildSettingsStore = creerMemoryGuildSettingsStore(),
): Command {
  const m = CATALOGUE.fr;
  return {
    data: new SlashCommandBuilder()
      .setName("rename")
      .setDescription(m.rename.commandeDescription)
      .setDescriptionLocalizations(localisations((x) => x.rename.commandeDescription))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
      .addUserOption((opt) =>
        opt
          .setName("membre")
          .setDescription(m.rename.membreOptionDescription)
          .setDescriptionLocalizations(localisations((x) => x.rename.membreOptionDescription))
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("style")
          .setDescription(m.rename.styleOptionDescription)
          .setDescriptionLocalizations(localisations((x) => x.rename.styleOptionDescription))
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("nouveau_nom")
          .setDescription(m.rename.nouveauNomOptionDescription)
          .setDescriptionLocalizations(localisations((x) => x.rename.nouveauNomOptionDescription)),
      )
      .addStringOption((opt) =>
        opt
          .setName("duree")
          .setDescription(m.rename.dureeOptionDescription)
          .setDescriptionLocalizations(localisations((x) => x.rename.dureeOptionDescription)),
      ),

    autocomplete: autocompleteStyle,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      // SOCLE : locale effective resolue TOT (toutes les reponses, erreurs incluses, sont
      // localisees).
      const { messages } = await resoudreContexteCommande(interaction, settingsStore);

      // Defense en profondeur : on revalide la permission de l'appelant (en plus
      // de default_member_permissions, qui peut etre relache par un admin de guild).
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
        await interaction.reply({
          content: messages.menuContextuel.styliserPermissionRefusee,
          ephemeral: true,
        });
        return;
      }

      const style = interaction.options.getString("style", true);
      if (!estStyleConnu(style)) {
        await interaction.reply({
          content: messageErreur("style-inconnu", style, messages.styliser),
          ephemeral: true,
        });
        return;
      }

      const membre = interaction.options.getMember("membre") as GuildMember | null;
      if (!membre) {
        await interaction.reply({
          content: messages.menuContextuel.styliserMembreIntrouvable,
          ephemeral: true,
        });
        return;
      }

      // Renommage temporaire (#38) : valide la duree AVANT tout edit (echec propre, aucun
      // renommage si la saisie est invalide). Absente => renommage permanent.
      const dureeSaisie = interaction.options.getString("duree");
      let expiresAt: number | undefined;
      if (dureeSaisie !== null) {
        const echeance = parserEcheance(dureeSaisie, Date.now());
        if (!echeance.ok) {
          await interaction.reply({ content: messages.rename.dureeInvalide, ephemeral: true });
          return;
        }
        expiresAt = echeance.expiresAt;
      }

      // Cooldown anti mass-rename (B1) : au-dela de 3 renommages/60 s pour cet invocateur
      // sur cette guilde, on REFUSE en ephemere avec le temps d'attente, AUCUN edit. Le jeton
      // est consomme ATOMIQUEMENT ici, AVANT l'await member.edit : sans cela, une rafale
      // concurrente franchit toutes le check avant le 1er enregistrement (TOCTOU) et depasse
      // la limite. Meme patron atomique que le budget d'auto-rename (guild-member-update).
      const messageCooldown = consommerCooldownOuMessage(cooldown, interaction, messages.cooldown);
      if (messageCooldown !== null) {
        await interaction.reply({ content: messageCooldown, ephemeral: true });
        return;
      }

      const source = sourceRename(membre, interaction.options.getString("nouveau_nom"));

      // Si renommage temporaire : POSER l'echeance AVANT de styliser, pour que le job de
      // balayage restaure le pseudo (round-trip #25 reutilise). rememberWithDeadline ecrit
      // l'echeance MEME si une ligne existe deja (membre deja sous auto-rename par role) : sans
      // rememberWithDeadline, un rememberIfAbsent serait un no-op et le rename « temporaire »
      // resterait PERMANENT en silence (audit). On retient si on a CREE la ligne : sur echec,
      // on ne forget() que ce qu'on a cree (jamais une ligne role-based preexistante).
      let echeanceLigneCreee = false;
      if (expiresAt !== undefined) {
        echeanceLigneCreee = await originalNickStore.rememberWithDeadline(
          membre.guild.id,
          membre.id,
          source,
          expiresAt,
        );
      }

      const resultat = await appliquerRename(membre, style, source, messages.styliser);
      if (!resultat.ok) {
        // Le rename a echoue : rien a reverter. On oublie l'echeance UNIQUEMENT si on a cree la
        // ligne (sinon on supprimerait un original pilote par les roles, corollaire de l'audit).
        if (echeanceLigneCreee) await originalNickStore.forget(membre.guild.id, membre.id);
        await interaction.reply({ content: resultat.message, ephemeral: true });
        return;
      }

      const embed = embedRenameOk(
        membre,
        resultat.pseudo,
        resultat.style,
        COULEUR_VERT,
        messages.rename.titreConfirmation,
        messages.styliser,
      );
      await interaction.reply({ embeds: [embed] });
    },
  };
}
