/**
 * Commande /renamioos — consentement MEMBRE a l'auto-rename (issue #27).
 *
 * ADAPTER Discord cote membre (pas admin) : chacun peut REFUSER (`opt-out`) ou REACTIVER
 * (`opt-in`) l'auto-rename SUR LUI, pour ce serveur. Aucune permission requise (commande
 * personnelle). Traduit l'interaction vers le port OptOutStore (provenance unique du
 * consentement) et repose une confirmation ephemere. Aucune logique de persistance ici
 * (le store la porte) ; le gate de consentement vit dans le domaine pur (styleAvecConsentement)
 * et est applique par l'evenement guildMemberUpdate.
 *
 * Sous-commandes :
 *  - opt-out : refuse l'auto-rename (le bot ne renommera plus ce membre sur ce serveur).
 *  - opt-in  : reactive l'auto-rename (defaut).
 */
import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { OptOutStore } from '../optout/store';
import type { Command } from './types';
import { COULEUR_VIOLET } from './couleurs';

/** Fabrique /renamioos : le store de consentement est injecte a la composition. */
export function creerRenamioosCommand(store: OptOutStore): Command {
  return {
    data: new SlashCommandBuilder()
      .setName('renamioos')
      .setDescription('Gère l’auto-rename te concernant sur ce serveur.')
      .addSubcommand((sub) =>
        sub
          .setName('opt-out')
          .setDescription('Refuse l’auto-rename : le bot ne renommera plus ton pseudo ici.'),
      )
      .addSubcommand((sub) =>
        sub.setName('opt-in').setDescription('Réactive l’auto-rename te concernant (défaut).'),
      ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '❌ Cette commande s’utilise sur un serveur.',
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.guildId;
      const memberId = interaction.user.id;
      const sub = interaction.options.getSubcommand();

      if (sub === 'opt-out') {
        await store.optOut(guildId, memberId);
        const embed = new EmbedBuilder()
          .setTitle('🚫 Auto-rename désactivé')
          .setColor(COULEUR_VIOLET)
          .setDescription(
            'Le bot ne renommera plus automatiquement ton pseudo sur ce serveur. ' +
              'Réactive-le quand tu veux avec `/renamioos opt-in`.',
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // sub === 'opt-in'
      await store.optIn(guildId, memberId);
      const embed = new EmbedBuilder()
        .setTitle('✅ Auto-rename réactivé')
        .setColor(COULEUR_VIOLET)
        .setDescription(
          'Le bot pourra de nouveau styliser automatiquement ton pseudo sur ce serveur.',
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
}
