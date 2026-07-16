/**
 * Commande /preview <style> [texte] (#26) — apercu PERSONNEL et EPHEMERE d'un style.
 *
 * Ne renomme personne, ne touche pas au serveur, n'exige AUCUNE permission : c'est
 * un /convert centre sur l'appelant. Adapter pur : extrait style + source (texte
 * fourni, sinon pseudo de l'appelant), appelle le domaine (convertirTexte), repose
 * le resultat. ÉCART VOLONTAIRE B4 (ADR-0003 d.3) : erreur metier -> message ephemere,
 * jamais de rendu vide. Toujours ephemeral (apercu prive, pas de pollution du salon).
 */
import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { convertirTexte, LIMITE_TEXTE_CONVERT } from "../domain/stylisation";
import type { Command } from "./types";
import { COULEUR_BLEU } from "./couleurs";
import { autocompleteStyle } from "./style-autocomplete";
import { capitaliser, estStyleConnu, messageErreur } from "./styliser";

/** Pseudo affiche de l'appelant : nickname serveur, sinon username global. */
function pseudoAppelant(interaction: ChatInputCommandInteraction): string {
  const nickname =
    interaction.member && "nickname" in interaction.member ? interaction.member.nickname : null;
  return nickname ?? interaction.user.username;
}

export const previewCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("preview")
    .setDescription(
      "Aperçu personnel d’un style (sur ton pseudo ou un texte), visible par toi seul.",
    )
    .addStringOption((opt) =>
      opt
        .setName("style")
        .setDescription("Le style à prévisualiser")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("texte")
        .setDescription("Texte à prévisualiser (optionnel ; sinon ton pseudo)")
        // Borne cOte Discord (UX) ; le domaine revalide ci-dessous (defense en profondeur).
        .setMaxLength(LIMITE_TEXTE_CONVERT),
    ),

  autocomplete: autocompleteStyle,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const style = interaction.options.getString("style", true);
    if (!estStyleConnu(style)) {
      await interaction.reply({ content: messageErreur("style-inconnu", style), ephemeral: true });
      return;
    }

    const source = interaction.options.getString("texte") ?? pseudoAppelant(interaction);
    // Garde texte-trop-long du domaine (meme borne que /convert) : un texte non borne insere
    // dans un field d'embed (cap 1024) le ferait jeter. Refus propre plutOt qu'erreur generique.
    if ([...source].length > LIMITE_TEXTE_CONVERT) {
      await interaction.reply({ content: messageErreur("texte-trop-long"), ephemeral: true });
      return;
    }

    const resultat = convertirTexte(source, style);
    if (!resultat.ok) {
      await interaction.reply({ content: messageErreur(resultat.erreur, style), ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`👀 Aperçu ${capitaliser(style)}`)
      .setColor(COULEUR_BLEU)
      .addFields(
        { name: "📝 Original", value: source, inline: false },
        { name: "🎨 Résultat", value: resultat.texte, inline: false },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
