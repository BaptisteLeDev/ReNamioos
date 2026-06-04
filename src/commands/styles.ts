/**
 * Commande /styles — affiche les styles disponibles avec un apercu.
 *
 * Successeur de styles_slash (bot.py:252). ÉCART VOLONTAIRE (B4, ADR-0003
 * decision 1) : les 9 styles sont publics (scriptify inclus). Chaque apercu est
 * DERIVE du domaine (apercuStyle -> convertirTexte) : aucun litteral UI a
 * maintenir, donc impossible qu'un style charge soit absent de l'embed.
 */
import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { STYLE_NAMES } from '../domain/styles';
import type { Command } from './types';
import { apercuStyle, capitaliser } from './styliser';

export const stylesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('styles')
    .setDescription('Affiche tous les styles de police disponibles.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎨 Styles disponibles')
      .setDescription('Voici tous les styles de police disponibles')
      .setColor(0xf1c40f)
      .addFields(
        STYLE_NAMES.map((style) => ({
          name: `**${capitaliser(style)}**`,
          value: apercuStyle(style),
          inline: true,
        })),
      );
    await interaction.reply({ embeds: [embed] });
  },
};
