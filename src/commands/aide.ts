/**
 * Commande /aide — affiche l'aide du bot.
 *
 * Successeur de aide_slash (bot.py:399). ÉCART VOLONTAIRE (B4, ADR-0003
 * decision 1) : annonce le nombre REEL de styles (9), DERIVE de STYLE_NAMES —
 * le legacy ecrivait « 8 styles » en dur (et omettait scriptify).
 *
 * Le compte « Rôles configurés » est DERIVE de la config auto-rename via le port
 * MappingStore (B8, ADR-0005), injecte a la composition. Source de verite UNIQUE :
 * plus de double source role->style. Depuis B8, la config est PAR SERVEUR : le compte
 * affiche est donc celui de la guild courante (store.list(guildId)) ; en DM (hors
 * guild) il vaut 0. Une commande = une fermeture sur le store.
 */
import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { STYLE_NAMES } from "../domain/styles";
import type { MappingStore } from "../mapping/store";
import type { Command } from "./types";
import { COULEUR_BLEU } from "./couleurs";

/** Fabrique /aide : le compte de roles mappes vient du store auto-rename (B8). */
export function creerAideCommand(mappingStore: MappingStore): Command {
  return {
    data: new SlashCommandBuilder().setName("aide").setDescription("Affiche l’aide du bot."),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      // ACK d'abord (T3/audit) : la lecture du store peut faire un round-trip Neon ; sur
      // cold-start (> 3 s) l'ack expirerait avant le 1er reply. On differe puis on editReply.
      await interaction.deferReply();

      const totalRoles = interaction.guildId
        ? Object.keys(await mappingStore.list(interaction.guildId)).length
        : 0;

      const embed = new EmbedBuilder()
        .setTitle("📖 Aide - ReNamioos")
        .setDescription("Bot de renommage avec polices Unicode stylisées")
        .setColor(COULEUR_BLEU)
        .addFields(
          {
            name: "🎨 Commandes principales",
            value: [
              "`/styles` - Affiche tous les styles",
              "`/convert <texte> <style>` - Convertit du texte",
              "`/preview <style> [texte]` - Aperçu privé d’un style",
              "`/rename <membre> <style> [nom] [durée]` - Renomme un membre",
              "`/rename-pending` - Renommages temporaires à venir",
              "`/rename-cancel <membre>` - Annule un renommage temporaire",
              "`/random <membre> [nom]` - Style aléatoire",
              "`/ping` - Teste la connexion",
            ].join("\n"),
            inline: false,
          },
          {
            name: "✨ Fonctionnalités",
            value: [
              `• ${STYLE_NAMES.length} styles de polices Unicode`,
              "• Auto-rename avec rôles",
              "• Conversion automatique chiffres → lettres",
              "• Majuscule automatique en début",
              "• Accents préservés",
            ].join("\n"),
            inline: false,
          },
          {
            name: "🎭 Auto-rename",
            value: `Rôles configurés : ${totalRoles}\nLe pseudo change automatiquement avec le rôle !`,
            inline: false,
          },
        )
        .setFooter({ text: "Créé avec ❤️ par Baptiste" });

      await interaction.editReply({ embeds: [embed] });
    },
  };
}
