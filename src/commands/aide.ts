/**
 * Commande /aide — affiche l'aide du bot.
 *
 * Successeur de aide_slash (bot.py:399). ÉCART VOLONTAIRE (B4, ADR-0003
 * decision 1) : annonce le nombre REEL de styles (9), DERIVE de STYLE_NAMES —
 * le legacy ecrivait « 8 styles » en dur (et omettait scriptify).
 *
 * Le compte « Rôles configurés » est DERIVE de la config auto-rename B6
 * (mapping roleId -> styleName, ADR-0004), injectee a la composition. Source de
 * verite UNIQUE : plus de double source role->style (l'ancien ROLE_CONFIG
 * legacy a ete retire). Une commande = une fermeture sur sa config.
 */
import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { STYLE_NAMES } from '../domain/styles';
import type { MappingRoleStyle } from '../domain/auto-rename';
import type { Command } from './types';

/** Fabrique /aide : le compte de roles mappes vient de la config auto-rename (B6). */
export function creerAideCommand(autoRenameMapping: MappingRoleStyle): Command {
  return {
  data: new SlashCommandBuilder().setName('aide').setDescription('Affiche l’aide du bot.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const totalRoles = Object.keys(autoRenameMapping).length;

    const embed = new EmbedBuilder()
      .setTitle('📖 Aide - ReNamioos')
      .setDescription('Bot de renommage avec polices Unicode stylisées')
      .setColor(0x3498db)
      .addFields(
        {
          name: '🎨 Commandes principales',
          value: [
            '`/styles` - Affiche tous les styles',
            '`/convert <texte> <style>` - Convertit du texte',
            '`/rename <membre> <style> [nom]` - Renomme un membre',
            '`/random <membre> [nom]` - Style aléatoire',
            '`/ping` - Teste la connexion',
          ].join('\n'),
          inline: false,
        },
        {
          name: '✨ Fonctionnalités',
          value: [
            `• ${STYLE_NAMES.length} styles de polices Unicode`,
            '• Auto-rename avec rôles',
            '• Conversion automatique chiffres → lettres',
            '• Majuscule automatique en début',
            '• Accents préservés',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🎭 Auto-rename',
          value: `Rôles configurés : ${totalRoles}\nLe pseudo change automatiquement avec le rôle !`,
          inline: false,
        },
      )
      .setFooter({ text: 'Créé avec ❤️ par Baptiste' });

    await interaction.reply({ embeds: [embed] });
  },
  };
}
