/**
 * Commande /convert <texte> <style> — stylise un texte (sans renommer personne).
 *
 * Successeur de convert_slash (bot.py:218). Adapter pur : extrait texte+style, appelle le
 * domaine, repose le resultat. ÉCART VOLONTAIRE (B4, ADR-0003 decision 3) : le domaine
 * renvoie un Result -> l'erreur metier (style inconnu, rien a styliser / deja stylise)
 * devient un message ephemere ; jamais de rendu vide ou fantaisiste.
 *
 * PREUVE D'USAGE DU SOCLE : l'embed de succes est produit par la FABRIQUE THEMEE (couleur
 * du theme, ou override de la guilde via /config) et son titre/champs sont resolus dans la
 * LOCALE effective (override /config > locale Discord > FR). Fabrique via injection
 * (`creerConvertCommand`), comme les autres commandes a dependances de ReNamioos.
 */
import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { convertirTexte, LIMITE_TEXTE_CONVERT } from "../domain/stylisation";
import type { Command } from "./types";
import { autocompleteStyle } from "./style-autocomplete";
import { capitaliser, estStyleConnu, messageErreur } from "./styliser";
import { resoudreContexteCommande } from "./contexte";
import { localisations } from "../i18n/localizations";
import { CATALOGUE } from "../i18n/catalog";
import type { GuildSettingsStore } from "../guildsettings/store";
import type { EmbedTheme } from "../theming/embed";

export function creerConvertCommand(
  settingsStore: GuildSettingsStore,
  embedFactory: EmbedTheme,
): Command {
  const m = CATALOGUE.fr;
  return {
    data: new SlashCommandBuilder()
      .setName("convert")
      .setDescription(m.convert.commandeDescription)
      .setDescriptionLocalizations(localisations((x) => x.convert.commandeDescription))
      .addStringOption((opt) =>
        opt
          .setName("texte")
          .setDescription(m.convert.texteOptionDescription)
          .setDescriptionLocalizations(localisations((x) => x.convert.texteOptionDescription))
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("style")
          .setDescription(m.convert.styleOptionDescription)
          .setDescriptionLocalizations(localisations((x) => x.convert.styleOptionDescription))
          .setRequired(true)
          .setAutocomplete(true),
      ),

    autocomplete: autocompleteStyle,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      // SOCLE : locale effective + couleur de guilde resolues TOT (erreurs ET succes localises).
      const { messages, settings } = await resoudreContexteCommande(interaction, settingsStore);

      const texte = interaction.options.getString("texte", true);
      const style = interaction.options.getString("style", true);

      // Borne l'entree AVANT toute construction d'embed (finding #24, CWE-20).
      // Longueur par code point (coherent avec tronquerPseudo).
      if ([...texte].length > LIMITE_TEXTE_CONVERT) {
        await interaction.reply({
          content: messageErreur("texte-trop-long", undefined, messages.styliser),
          ephemeral: true,
        });
        return;
      }

      if (!estStyleConnu(style)) {
        await interaction.reply({
          content: messageErreur("style-inconnu", style, messages.styliser),
          ephemeral: true,
        });
        return;
      }

      const resultat = convertirTexte(texte, style);
      if (!resultat.ok) {
        await interaction.reply({
          content: messageErreur(resultat.erreur, style, messages.styliser),
          ephemeral: true,
        });
        return;
      }

      const embed = embedFactory({ couleurGuilde: settings.embedColor })
        .setTitle(messages.convert.titre({ style: capitaliser(style) }))
        .addFields(
          { name: messages.convert.champOriginal, value: texte, inline: false },
          { name: messages.convert.champResultat, value: resultat.texte, inline: false },
        );
      // ÉCART VOLONTAIRE (B4, #45) : le SUCCÈS devient éphémère, comme les erreurs — /convert
      // ne pollue plus le salon (le résultat stylisé est destiné à un copier-coller privé).
      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
}
