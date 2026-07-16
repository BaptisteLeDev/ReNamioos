/**
 * Commande /rename-cancel @membre — annule un renommage temporaire (issue #46, F2).
 *
 * Annulation MANUELLE d'un `/rename ... duree:` avant son echeance : restaure le pseudo
 * original immediatement ET supprime la ligne de persistance. Reutilise `restaurerPseudo`
 * (styliser), le meme « retour » que le job de balayage (sweep-temporaire) et l'evenement
 * guildMemberUpdate : on ne restaure QUE sur succes de l'edit, sinon la ligne est CONSERVEE
 * pour un retentera ulterieur (par ce meme flux ou par le job).
 *
 * Ne cible QUE les lignes TEMPORAIRES (`getPending` renvoie null pour une ligne role-only
 * #25) : annuler ne doit jamais oublier un original pilote par les roles. Meme garde de
 * permission (Manage Nicknames) et commande separee — cf. rename-pending.ts pour le choix.
 */
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { Command } from "./types";
import type { OriginalNickStore } from "../original-nick/store";
import { restaurerPseudo } from "./styliser";

export function creerRenameCancelCommand(originalNickStore: OriginalNickStore): Command {
  return {
    data: new SlashCommandBuilder()
      .setName("rename-cancel")
      .setDescription("Annule un renommage temporaire et restaure le pseudo d’origine.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
      .addUserOption((opt) =>
        opt.setName("membre").setDescription("Le membre dont annuler le renommage").setRequired(true),
      ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      // Defense en profondeur : meme garde que /rename.
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
        await interaction.reply({
          content: "❌ Tu n’as pas la permission de gérer les surnoms.",
          ephemeral: true,
        });
        return;
      }

      const membre = interaction.options.getMember("membre") as GuildMember | null;
      if (!membre) {
        await interaction.reply({
          content: "❌ Membre introuvable sur ce serveur.",
          ephemeral: true,
        });
        return;
      }

      // Ne cible QUE les renommages temporaires (echeance) : une ligne role-only renvoie null.
      const pending = await originalNickStore.getPending(membre.guild.id, membre.id);
      if (!pending) {
        await interaction.reply({
          content: "ℹ️ Ce membre n’a aucun renommage temporaire actif.",
          ephemeral: true,
        });
        return;
      }

      // Restaure d'abord ; on n'oublie la ligne QU'EN cas de succes (comme le job de balayage).
      const resultat = await restaurerPseudo(membre, pending.nick);
      if (!resultat.ok) {
        await interaction.reply({ content: resultat.message, ephemeral: true });
        return;
      }
      await originalNickStore.forget(membre.guild.id, membre.id);

      await interaction.reply({
        content: `✅ Renommage temporaire de ${membre.toString()} annulé, pseudo restauré : **${resultat.pseudo}**.`,
      });
    },
  };
}
