/**
 * Menu contextuel MEMBRE -> « Styliser » (proposition ReNamioos, axe UX).
 *
 * Clic droit sur un membre -> Apps -> reponse EPHEMERE avec un select des 9 styles (apercu du
 * pseudo dans chaque). La selection applique le style via le flux PARTAGE `appliquerRename`
 * (hierarchie + domaine + troncature + edit) — aucune duplication de la logique de rename.
 *
 * Permission Manage Nicknames requise (calquee sur /rename), en profondeur : cachee cote
 * Discord (`setDefaultMemberPermissions`) ET revalidee a l'ouverture ET au select. Le select
 * est STATELESS (customId = `rnm-style:<memberId>`) : restart-safe, un token expire (15 min)
 * echoue proprement. Apres application, le select est DESACTIVE (finalisation).
 */
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  type GuildMember,
  type MessageComponentInteraction,
  type MessageContextMenuCommandInteraction,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import { STYLE_NAMES, type StyleName } from "../domain/styles";
import type { CommandContextuelle, GestionnaireComposant } from "./types";
import {
  apercuStyle,
  appliquerRename,
  capitaliser,
  champsRename,
  estStyleConnu,
  messageErreur,
  sourceRename,
} from "./styliser";
import { resoudreContexteCommande, type ContexteCommande } from "./contexte";
import { localisations } from "../i18n/localizations";
import { CATALOGUE } from "../i18n/catalog";
import type { GuildSettingsStore } from "../guildsettings/store";
import type { EmbedTheme } from "../theming/embed";

/** Prefixe de customId du select de stylisation (routage stateless). */
export const PREFIXE_STYLISER = "rnm-style";

/** Longueur max de l'echantillon d'apercu (garde le label de select sous 100 chars). */
const ECHANTILLON_MAX = 16;

export function customIdStyliser(memberId: string): string {
  return `${PREFIXE_STYLISER}:${memberId}`;
}

export function parseCustomIdStyliser(customId: string): { memberId: string } | null {
  const parts = customId.split(":");
  if (parts.length !== 2 || parts[0] !== PREFIXE_STYLISER) return null;
  const memberId = parts[1];
  if (!memberId) return null;
  return { memberId };
}

/** Action row du select : apercu du pseudo du membre dans chaque style. */
function construireSelect(
  memberId: string,
  echantillon: string,
  placeholder: string,
  desactive = false,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const bref = [...echantillon].slice(0, ECHANTILLON_MAX).join("");
  const select = new StringSelectMenuBuilder()
    .setCustomId(customIdStyliser(memberId))
    .setPlaceholder(placeholder)
    .setDisabled(desactive)
    .addOptions(
      STYLE_NAMES.map((style) => ({
        label: `${capitaliser(style)} · ${apercuStyle(style, bref)}`.slice(0, 100),
        value: style,
      })),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

/** Fabrique de la commande contextuelle membre (le select n'a besoin que des reglages). */
export function creerStyliserContextuelCommand(
  settingsStore: GuildSettingsStore,
): CommandContextuelle {
  return {
    data: new ContextMenuCommandBuilder()
      .setName(CATALOGUE.fr.menuContextuel.styliserNom)
      .setNameLocalizations(localisations((m) => m.menuContextuel.styliserNom))
      .setType(ApplicationCommandType.User)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(
      interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction,
    ): Promise<void> {
      if (!interaction.isUserContextMenuCommand()) return;
      const ctx = await resoudreContexteCommande(interaction, settingsStore);

      // Defense en profondeur : revalide la permission de l'appelant (comme /rename).
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
        await interaction.reply({
          content: ctx.messages.menuContextuel.styliserPermissionRefusee,
          ephemeral: true,
        });
        return;
      }

      const row = construireSelect(
        interaction.targetId,
        interaction.targetUser.username,
        ctx.messages.menuContextuel.selectStyle,
      );
      await interaction.reply({ components: [row], ephemeral: true });
    },
  };
}

/** Confirmation THEMEE (socle) reutilisant les champs partages avec /rename (anti-dup). */
function embedConfirmation(
  ctx: ContexteCommande,
  membre: GuildMember,
  pseudo: string,
  style: StyleName,
  embedFactory: EmbedTheme,
) {
  return embedFactory({ couleurGuilde: ctx.settings.embedColor })
    .setTitle(ctx.messages.menuContextuel.styliserApplique)
    .addFields(...champsRename(membre, pseudo, style, ctx.messages.styliser));
}

/** Gestionnaire du select : applique le style au membre via le flux partage. */
export function creerGestionnaireStyliser(
  settingsStore: GuildSettingsStore,
  embedFactory: EmbedTheme,
): GestionnaireComposant {
  return {
    prefixe: PREFIXE_STYLISER,

    async execute(interaction: MessageComponentInteraction): Promise<void> {
      if (!interaction.isStringSelectMenu()) return;
      const cible = parseCustomIdStyliser(interaction.customId);
      if (cible === null) return;

      const ctx = await resoudreContexteCommande(interaction, settingsStore);

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
        await interaction.reply({
          content: ctx.messages.menuContextuel.styliserPermissionRefusee,
          ephemeral: true,
        });
        return;
      }

      const style = interaction.values[0];
      if (style === undefined || !estStyleConnu(style)) {
        await interaction.reply({
          content: messageErreur("style-inconnu", style, ctx.messages.styliser),
          ephemeral: true,
        });
        return;
      }

      if (!interaction.guild) {
        await interaction.reply({
          content: ctx.messages.menuContextuel.horsServeur,
          ephemeral: true,
        });
        return;
      }

      const membre = await interaction.guild.members.fetch(cible.memberId).catch(() => null);
      if (membre === null) {
        await interaction.reply({
          content: ctx.messages.menuContextuel.styliserMembreIntrouvable,
          ephemeral: true,
        });
        return;
      }

      const source = sourceRename(membre, null);
      const resultat = await appliquerRename(membre, style, source, ctx.messages.styliser);
      if (!resultat.ok) {
        await interaction.reply({ content: resultat.message, ephemeral: true });
        return;
      }

      // Succes : confirmation themee + select DESACTIVE (finalisation, plus de re-selection).
      const rowDesactive = construireSelect(
        cible.memberId,
        membre.user.username,
        ctx.messages.menuContextuel.selectStyle,
        true,
      );
      await interaction.update({
        embeds: [embedConfirmation(ctx, membre, resultat.pseudo, resultat.style, embedFactory)],
        components: [rowDesactive],
      });
    },
  };
}
