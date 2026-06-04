/**
 * Commande /random <membre> [nouveau_nom] — renomme avec un style ALEATOIRE.
 *
 * Successeur de random_slash (bot.py:344). Choisit un style au hasard parmi les
 * 9, puis delegue au MEME flux partage que /rename (appliquerRename). Pas de
 * check de style (toujours valide). Memes erreurs propres (permission appelant,
 * hierarchie, refus propre, Forbidden bot) — ÉCART VOLONTAIRE B4 (ADR-0003 d.3).
 */
import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import { STYLE_NAMES, type StyleName } from '../domain/styles';
import type { Command } from './types';
import { appliquerRename, sourceRename } from './styliser';

const COULEUR_VIOLET = 0x9b59b6;

/** Tire un style au hasard parmi les 9 (extrait pour rester trivial et lisible). */
function styleAleatoire(): StyleName {
  const i = Math.floor(Math.random() * STYLE_NAMES.length);
  return STYLE_NAMES[i]!;
}

export const randomCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('random')
    .setDescription('Renomme un membre avec un style aléatoire.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption((opt) =>
      opt.setName('membre').setDescription('Le membre à renommer').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('nouveau_nom').setDescription('Nouveau nom (optionnel ; sinon nom actuel)'),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({
        content: '❌ Tu n’as pas la permission de gérer les surnoms.',
        ephemeral: true,
      });
      return;
    }

    const membre = interaction.options.getMember('membre') as GuildMember | null;
    if (!membre) {
      await interaction.reply({ content: '❌ Membre introuvable sur ce serveur.', ephemeral: true });
      return;
    }

    const style = styleAleatoire();
    const source = sourceRename(membre, interaction.options.getString('nouveau_nom'));
    const resultat = await appliquerRename(membre, style, source);
    if (!resultat.ok) {
      await interaction.reply({ content: resultat.message, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎲 Membre renommé (aléatoire)')
      .setColor(COULEUR_VIOLET)
      .addFields(
        { name: '👤 Membre', value: membre.toString(), inline: true },
        { name: '🎨 Style', value: resultat.style, inline: true },
        { name: '📝 Nouveau pseudo', value: resultat.pseudo, inline: false },
      );
    await interaction.reply({ embeds: [embed] });
  },
};
