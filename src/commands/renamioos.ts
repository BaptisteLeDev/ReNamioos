/**
 * Commande /renamioos — reglages MEMBRE de l'auto-rename (issue #27 + signature de style).
 *
 * ADAPTER Discord cote membre (pas admin) : chacun gere l'auto-rename SUR LUI, pour ce
 * serveur. Aucune permission requise (commande personnelle). Traduit l'interaction vers deux
 * ports (OptOutStore, StylePreferenceStore) et repose une confirmation ephemere. Aucune
 * logique de persistance ici (les stores la portent) ; la priorite (opt-out > signature >
 * role) vit dans le domaine pur (styleEffectif), appliquee par l'evenement guildMemberUpdate.
 *
 * Sous-commandes :
 *  - opt-out : refuse l'auto-rename (le bot ne renommera plus ce membre sur ce serveur).
 *  - opt-in  : reactive l'auto-rename (defaut).
 *  - style   : choisit SA signature de style (prime sur le style du role a l'auto-rename).
 *  - reset   : supprime la signature (retour au style du role ; minimisation PII D8).
 */
import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { OptOutStore } from "../optout/store";
import type { StylePreferenceStore } from "../style-preference/store";
import type { Command } from "./types";
import { COULEUR_VIOLET } from "./couleurs";
import { autocompleteStyle } from "./style-autocomplete";
import { capitaliser, estStyleConnu, messageErreur } from "./styliser";

/** Fabrique /renamioos : les stores (consentement + signature) sont injectes a la composition. */
export function creerRenamioosCommand(
  optOutStore: OptOutStore,
  stylePreferenceStore: StylePreferenceStore,
): Command {
  return {
    data: new SlashCommandBuilder()
      .setName("renamioos")
      .setDescription("Gère l’auto-rename te concernant sur ce serveur.")
      .addSubcommand((sub) =>
        sub
          .setName("opt-out")
          .setDescription("Refuse l’auto-rename : le bot ne renommera plus ton pseudo ici."),
      )
      .addSubcommand((sub) =>
        sub.setName("opt-in").setDescription("Réactive l’auto-rename te concernant (défaut)."),
      )
      .addSubcommand((sub) =>
        sub
          .setName("style")
          .setDescription("Choisis TON style : il prime sur le style du rôle à l’auto-rename.")
          .addStringOption((opt) =>
            opt
              .setName("style")
              .setDescription("Le style à adopter comme signature")
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("reset")
          .setDescription("Supprime ta signature de style (retour au style du rôle)."),
      ),

    autocomplete: autocompleteStyle,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.guildId) {
        await interaction.reply({
          content: "❌ Cette commande s’utilise sur un serveur.",
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.guildId;
      const memberId = interaction.user.id;
      const sub = interaction.options.getSubcommand();

      if (sub === "opt-out") {
        await optOutStore.optOut(guildId, memberId);
        const embed = new EmbedBuilder()
          .setTitle("🚫 Auto-rename désactivé")
          .setColor(COULEUR_VIOLET)
          .setDescription(
            "Le bot ne renommera plus automatiquement ton pseudo sur ce serveur. " +
              "Réactive-le quand tu veux avec `/renamioos opt-in`.",
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (sub === "opt-in") {
        await optOutStore.optIn(guildId, memberId);
        const embed = new EmbedBuilder()
          .setTitle("✅ Auto-rename réactivé")
          .setColor(COULEUR_VIOLET)
          .setDescription(
            "Le bot pourra de nouveau styliser automatiquement ton pseudo sur ce serveur.",
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (sub === "style") {
        const style = interaction.options.getString("style", true);
        if (!estStyleConnu(style)) {
          await interaction.reply({
            content: messageErreur("style-inconnu", style),
            ephemeral: true,
          });
          return;
        }
        await stylePreferenceStore.set(guildId, memberId, style);
        const embed = new EmbedBuilder()
          .setTitle("🖋️ Signature de style enregistrée")
          .setColor(COULEUR_VIOLET)
          .setDescription(
            `Ta signature est **${capitaliser(style)}**. À l’auto-rename, elle prime sur le ` +
              "style du rôle. Retire-la avec `/renamioos reset`.",
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // sub === 'reset' : minimisation PII (D8) — on SUPPRIME la ligne.
      await stylePreferenceStore.clear(guildId, memberId);
      const embed = new EmbedBuilder()
        .setTitle("🧹 Signature de style supprimée")
        .setColor(COULEUR_VIOLET)
        .setDescription(
          "Ta signature est retirée : à l’auto-rename, tu retrouves le style de ton rôle.",
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
}
