/**
 * Commande /rename <membre> <style> [nouveau_nom] — renomme un membre stylise.
 *
 * Successeur de rename_slash (bot.py:282). Adapter : verifie la permission Manage
 * Nicknames de l'APPELANT, resout la source (nouveau_nom sinon nick||name),
 * delegue au flux partage appliquerRename (domaine + troncature + edit). Toutes
 * les erreurs (permission, style inconnu, refus propre, hierarchie, Forbidden
 * bot) repondent en ephemere sans renommage — ÉCART VOLONTAIRE B4 (ADR-0003 d.3).
 */
import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { Command } from './types';
import { autocompleteStyle } from './style-autocomplete';
import { appliquerRename, estStyleConnu, messageErreur, sourceRename } from './styliser';

const COULEUR_VERT = 0x2ecc71;

export const renameCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Renomme un membre avec un style.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption((opt) =>
      opt.setName('membre').setDescription('Le membre à renommer').setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('style')
        .setDescription('Le style à appliquer')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt.setName('nouveau_nom').setDescription('Nouveau nom (optionnel ; sinon nom actuel)'),
    ),

  autocomplete: autocompleteStyle,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Defense en profondeur : on revalide la permission de l'appelant (en plus
    // de default_member_permissions, qui peut etre relache par un admin de guild).
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({
        content: '❌ Tu n’as pas la permission de gérer les surnoms.',
        ephemeral: true,
      });
      return;
    }

    const style = interaction.options.getString('style', true);
    if (!estStyleConnu(style)) {
      await interaction.reply({ content: messageErreur('style-inconnu', style), ephemeral: true });
      return;
    }

    const membre = interaction.options.getMember('membre') as GuildMember | null;
    if (!membre) {
      await interaction.reply({ content: '❌ Membre introuvable sur ce serveur.', ephemeral: true });
      return;
    }

    const source = sourceRename(membre, interaction.options.getString('nouveau_nom'));
    const resultat = await appliquerRename(membre, style, source);
    if (!resultat.ok) {
      await interaction.reply({ content: resultat.message, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Membre renommé')
      .setColor(COULEUR_VERT)
      .addFields(
        { name: '👤 Membre', value: membre.toString(), inline: true },
        { name: '🎨 Style', value: resultat.style, inline: true },
        { name: '📝 Nouveau pseudo', value: resultat.pseudo, inline: false },
      );
    await interaction.reply({ embeds: [embed] });
  },
};
