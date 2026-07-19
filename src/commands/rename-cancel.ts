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
import { resoudreContexteCommande } from "./contexte";
import { localisations } from "../i18n/localizations";
import { CATALOGUE } from "../i18n/catalog";
import type { GuildSettingsStore } from "../guildsettings/store";
import { creerMemoryGuildSettingsStore } from "../guildsettings/memory-store";

export function creerRenameCancelCommand(
  originalNickStore: OriginalNickStore,
  settingsStore: GuildSettingsStore = creerMemoryGuildSettingsStore(),
): Command {
  const m = CATALOGUE.fr;
  return {
    data: new SlashCommandBuilder()
      .setName("rename-cancel")
      .setDescription(m.renameCancel.commandeDescription)
      .setDescriptionLocalizations(localisations((x) => x.renameCancel.commandeDescription))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
      .addUserOption((opt) =>
        opt
          .setName("membre")
          .setDescription(m.renameCancel.membreOptionDescription)
          .setDescriptionLocalizations(localisations((x) => x.renameCancel.membreOptionDescription))
          .setRequired(true),
      ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const { messages } = await resoudreContexteCommande(interaction, settingsStore);

      // Defense en profondeur : meme garde que /rename.
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
        await interaction.reply({
          content: messages.menuContextuel.styliserPermissionRefusee,
          ephemeral: true,
        });
        return;
      }

      const membre = interaction.options.getMember("membre") as GuildMember | null;
      if (!membre) {
        await interaction.reply({
          content: messages.menuContextuel.styliserMembreIntrouvable,
          ephemeral: true,
        });
        return;
      }

      // Ne cible QUE les renommages temporaires (echeance) : une ligne role-only renvoie null.
      const pending = await originalNickStore.getPending(membre.guild.id, membre.id);
      if (!pending) {
        await interaction.reply({
          content: messages.renameCancel.aucunRenommageTemporaire,
          ephemeral: true,
        });
        return;
      }

      // Restaure d'abord ; on n'oublie la ligne QU'EN cas de succes (comme le job de balayage).
      const resultat = await restaurerPseudo(membre, pending.nick, messages.styliser);
      if (!resultat.ok) {
        await interaction.reply({ content: resultat.message, ephemeral: true });
        return;
      }
      await originalNickStore.forget(membre.guild.id, membre.id);

      await interaction.reply({
        content: messages.renameCancel.confirmation({
          membre: membre.toString(),
          pseudo: resultat.pseudo,
        }),
      });
    },
  };
}
