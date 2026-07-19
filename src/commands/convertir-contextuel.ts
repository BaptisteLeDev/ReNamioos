/**
 * Menu contextuel MESSAGE -> « Convertir en stylisé » (proposition ReNamioos, axe UX).
 *
 * Clic droit sur un message -> Apps -> reponse EPHEMERE avec le texte rendu dans un style,
 * plus un select pour changer de style. ADAPTER pur : extrait le contenu du message, delegue
 * au domaine (convertirTexte) et repose le resultat via la fabrique themee (comme /convert).
 *
 * SECURITE (issue #45) : le contenu vient d'un TIERS -> `assainirSource` (dans convertirTexte)
 * retire l'invisible/zalgo, et `neutraliserAffichage` casse le markdown/mentions a l'affichage.
 * EPHEMERE uniquement : jamais de republication du contenu d'autrui.
 *
 * Le select est STATELESS (customId = `rnm-conv:<channelId>:<messageId>`) : au changement de
 * style, le gestionnaire re-recupere le message d'origine et re-stylise. Aucun collecteur en
 * memoire -> survit a un redemarrage ; un token d'interaction expire (15 min) echoue proprement.
 */
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  StringSelectMenuBuilder,
  type EmbedBuilder,
  type MessageComponentInteraction,
  type MessageContextMenuCommandInteraction,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import { convertirTexte, LIMITE_TEXTE_CONVERT } from "../domain/stylisation";
import { STYLE_NAMES, type StyleName } from "../domain/styles";
import type { CommandContextuelle, GestionnaireComposant } from "./types";
import { apercuStyle, capitaliser, estStyleConnu, messageErreur } from "./styliser";
import { neutraliserAffichage } from "./affichage-sur";
import { resoudreContexteCommande, type ContexteCommande } from "./contexte";
import { localisations } from "../i18n/localizations";
import { CATALOGUE } from "../i18n/catalog";
import type { GuildSettingsStore } from "../guildsettings/store";
import type { EmbedTheme } from "../theming/embed";

/** Prefixe de customId du select de conversion (routage stateless). */
export const PREFIXE_CONVERTIR = "rnm-conv";

/** Style applique par defaut a l'ouverture (le plus « joli », coherent avec les exemples). */
const STYLE_DEFAUT_CONVERT: StyleName = "cursive";

/** Encode le customId stateless : prefixe + salon + message (tous des snowflakes courts). */
export function customIdConvertir(channelId: string, messageId: string): string {
  return `${PREFIXE_CONVERTIR}:${channelId}:${messageId}`;
}

/** Re-decode le customId, ou `null` s'il n'appartient pas a ce gestionnaire. */
export function parseCustomIdConvertir(
  customId: string,
): { channelId: string; messageId: string } | null {
  const parts = customId.split(":");
  if (parts.length !== 3 || parts[0] !== PREFIXE_CONVERTIR) return null;
  const [, channelId, messageId] = parts;
  if (!channelId || !messageId) return null;
  return { channelId, messageId };
}

/**
 * Prepare la source a partir du contenu brut : `null` si vide (rien a convertir), sinon la
 * source tronquee a {@link LIMITE_TEXTE_CONVERT} code points (avec un drapeau `tronque`).
 */
function preparerSource(contenu: string): { source: string; tronque: boolean } | null {
  if (contenu.trim().length === 0) return null;
  const cps = [...contenu];
  if (cps.length > LIMITE_TEXTE_CONVERT) {
    return { source: cps.slice(0, LIMITE_TEXTE_CONVERT).join(""), tronque: true };
  }
  return { source: contenu, tronque: false };
}

/** Action row du select de styles, style courant marque par defaut. */
function construireSelect(
  styleActuel: StyleName,
  channelId: string,
  messageId: string,
  placeholder: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(customIdConvertir(channelId, messageId))
    .setPlaceholder(placeholder)
    .addOptions(
      STYLE_NAMES.map((style) => ({
        label: `${capitaliser(style)} · ${apercuStyle(style, "Abc")}`.slice(0, 100),
        value: style,
        default: style === styleActuel,
      })),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

type ReponseConversion =
  | {
      ok: true;
      embeds: EmbedBuilder[];
      components: ActionRowBuilder<StringSelectMenuBuilder>[];
    }
  | { ok: false; message: string };

/** Construit l'embed themé + le select. Partagee par l'ouverture et le changement de style. */
function construireReponse(opts: {
  source: string;
  tronque: boolean;
  style: StyleName;
  channelId: string;
  messageId: string;
  ctx: ContexteCommande;
  embedFactory: EmbedTheme;
}): ReponseConversion {
  const { source, tronque, style, channelId, messageId, ctx, embedFactory } = opts;
  const resultat = convertirTexte(source, style);
  if (!resultat.ok) {
    return { ok: false, message: messageErreur(resultat.erreur, style, ctx.messages.styliser) };
  }

  const embed = embedFactory({ couleurGuilde: ctx.settings.embedColor })
    .setTitle(ctx.messages.convert.titre({ style: capitaliser(style) }))
    .addFields(
      { name: ctx.messages.convert.champOriginal, value: neutraliserAffichage(source) || "—" },
      { name: ctx.messages.convert.champResultat, value: resultat.texte },
    );
  if (tronque) {
    embed.setDescription(
      ctx.messages.menuContextuel.convertirTronque({ limite: LIMITE_TEXTE_CONVERT }),
    );
  }
  const row = construireSelect(style, channelId, messageId, ctx.messages.menuContextuel.selectStyle);
  return { ok: true, embeds: [embed], components: [row] };
}

/** Fabrique de la commande contextuelle message (injecte le socle : reglages + theme). */
export function creerConvertirContextuelCommand(
  settingsStore: GuildSettingsStore,
  embedFactory: EmbedTheme,
): CommandContextuelle {
  return {
    data: new ContextMenuCommandBuilder()
      .setName(CATALOGUE.fr.menuContextuel.convertirNom)
      .setNameLocalizations(localisations((m) => m.menuContextuel.convertirNom))
      .setType(ApplicationCommandType.Message),

    async execute(
      interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction,
    ): Promise<void> {
      if (!interaction.isMessageContextMenuCommand()) return;
      const ctx = await resoudreContexteCommande(interaction, settingsStore);

      const prepare = preparerSource(interaction.targetMessage.content);
      if (prepare === null) {
        await interaction.reply({
          content: ctx.messages.menuContextuel.convertirVide,
          ephemeral: true,
        });
        return;
      }

      const reponse = construireReponse({
        source: prepare.source,
        tronque: prepare.tronque,
        style: STYLE_DEFAUT_CONVERT,
        channelId: interaction.channelId,
        messageId: interaction.targetId,
        ctx,
        embedFactory,
      });
      if (!reponse.ok) {
        await interaction.reply({ content: reponse.message, ephemeral: true });
        return;
      }
      await interaction.reply({
        embeds: reponse.embeds,
        components: reponse.components,
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
    },
  };
}

/** Gestionnaire du select de changement de style (routage stateless par prefixe). */
export function creerGestionnaireConvertir(
  settingsStore: GuildSettingsStore,
  embedFactory: EmbedTheme,
): GestionnaireComposant {
  return {
    prefixe: PREFIXE_CONVERTIR,

    async execute(interaction: MessageComponentInteraction): Promise<void> {
      if (!interaction.isStringSelectMenu()) return;
      const cible = parseCustomIdConvertir(interaction.customId);
      if (cible === null) return;

      const ctx = await resoudreContexteCommande(interaction, settingsStore);
      const style = interaction.values[0];
      if (style === undefined || !estStyleConnu(style)) {
        await interaction.reply({
          content: messageErreur("style-inconnu", style, ctx.messages.styliser),
          ephemeral: true,
        });
        return;
      }

      // Re-recupere le message d'origine (stateless) : supprime/inaccessible -> refus propre.
      const canal = await interaction.client.channels.fetch(cible.channelId).catch(() => null);
      const message =
        canal && canal.isTextBased()
          ? await canal.messages.fetch(cible.messageId).catch(() => null)
          : null;
      if (message === null) {
        await interaction.reply({
          content: ctx.messages.menuContextuel.convertirIntrouvable,
          ephemeral: true,
        });
        return;
      }

      const prepare = preparerSource(message.content);
      if (prepare === null) {
        await interaction.reply({
          content: ctx.messages.menuContextuel.convertirVide,
          ephemeral: true,
        });
        return;
      }

      const reponse = construireReponse({
        source: prepare.source,
        tronque: prepare.tronque,
        style,
        channelId: cible.channelId,
        messageId: cible.messageId,
        ctx,
        embedFactory,
      });
      if (!reponse.ok) {
        await interaction.reply({ content: reponse.message, ephemeral: true });
        return;
      }
      await interaction.update({ embeds: reponse.embeds, components: reponse.components });
    },
  };
}
