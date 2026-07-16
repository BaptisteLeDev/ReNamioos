/**
 * Commande /convert <texte> <style> — stylise un texte (sans renommer personne).
 *
 * Successeur de convert_slash (bot.py:218). Adapter pur : extrait texte+style,
 * appelle le domaine, repose le resultat. ÉCART VOLONTAIRE (B4, ADR-0003
 * decision 3) : le domaine renvoie un Result -> l'erreur metier (style inconnu,
 * rien a styliser / deja stylise) devient un message ephemere ; jamais de rendu
 * vide ou fantaisiste.
 */
import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { convertirTexte, LIMITE_TEXTE_CONVERT } from "../domain/stylisation";
import type { Command } from "./types";
import { COULEUR_BLEU } from "./couleurs";
import { autocompleteStyle } from "./style-autocomplete";
import { capitaliser, estStyleConnu, messageErreur } from "./styliser";

export const convertCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("convert")
    .setDescription("Convertit un texte dans un style Unicode.")
    .addStringOption((opt) =>
      opt.setName("texte").setDescription("Le texte à convertir").setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("style")
        .setDescription("Le style de police à appliquer")
        .setRequired(true)
        .setAutocomplete(true),
    ),

  autocomplete: autocompleteStyle,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const texte = interaction.options.getString("texte", true);
    const style = interaction.options.getString("style", true);

    // Borne l'entree AVANT toute construction d'embed (finding #24, CWE-20).
    // Longueur par code point (coherent avec tronquerPseudo).
    if ([...texte].length > LIMITE_TEXTE_CONVERT) {
      await interaction.reply({ content: messageErreur("texte-trop-long"), ephemeral: true });
      return;
    }

    if (!estStyleConnu(style)) {
      await interaction.reply({ content: messageErreur("style-inconnu", style), ephemeral: true });
      return;
    }

    const resultat = convertirTexte(texte, style);
    if (!resultat.ok) {
      await interaction.reply({ content: messageErreur(resultat.erreur, style), ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`✨ Conversion en ${capitaliser(style)}`)
      .setColor(COULEUR_BLEU)
      .addFields(
        { name: "📝 Original", value: texte, inline: false },
        { name: "🎨 Résultat", value: resultat.texte, inline: false },
      );
    // ÉCART VOLONTAIRE (B4, #45) : le SUCCÈS devient éphémère, comme les erreurs — /convert
    // ne pollue plus le salon (le résultat stylisé est destiné à un copier-coller privé).
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
