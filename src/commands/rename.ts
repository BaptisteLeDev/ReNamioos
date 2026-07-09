/**
 * Commande /rename <membre> <style> [nouveau_nom] [duree] — renomme un membre stylise.
 *
 * Successeur de rename_slash (bot.py:282). Adapter : verifie la permission Manage
 * Nicknames de l'APPELANT, resout la source (nouveau_nom sinon nick||name),
 * delegue au flux partage appliquerRename (domaine + troncature + edit). Toutes
 * les erreurs (permission, style inconnu, refus propre, hierarchie, Forbidden
 * bot) repondent en ephemere sans renommage — ÉCART VOLONTAIRE B4 (ADR-0003 d.3).
 *
 * RENOMMAGE TEMPORAIRE (issue #38) : option `duree` optionnelle (`2h`, `30m`, `7j` ou
 * date ISO). Fournie => on MEMORISE le pseudo SOURCE avec une echeance (reutilise la
 * persistance #25, port OriginalNickStore) AVANT de styliser ; un job de balayage
 * (src/jobs/sweep-temporaire) restaure le pseudo a l'echeance. Absente => renommage
 * permanent classique (aucune echeance memorisee).
 */
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { Command } from "./types";
import { COULEUR_VERT } from "./couleurs";
import { autocompleteStyle } from "./style-autocomplete";
import {
  appliquerRename,
  embedRenameOk,
  estStyleConnu,
  messageErreur,
  sourceRename,
} from "./styliser";
import { parserEcheance } from "../domain/rename-temporaire";
import type { OriginalNickStore } from "../original-nick/store";

/** Message d'erreur (FR) pour une duree invalide (#38). */
function messageDureeInvalide(): string {
  return "❌ Durée invalide. Utilise une durée comme `2h`, `30m`, `7j`, ou une date ISO future.";
}

export function creerRenameCommand(originalNickStore: OriginalNickStore): Command {
  return {
    data: new SlashCommandBuilder()
      .setName("rename")
      .setDescription("Renomme un membre avec un style.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
      .addUserOption((opt) =>
        opt.setName("membre").setDescription("Le membre à renommer").setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("style")
          .setDescription("Le style à appliquer")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((opt) =>
        opt.setName("nouveau_nom").setDescription("Nouveau nom (optionnel ; sinon nom actuel)"),
      )
      .addStringOption((opt) =>
        opt
          .setName("duree")
          .setDescription("Auto-revert après ce délai (ex. 2h, 30m, 7j) ou à une date ISO"),
      ),

    autocomplete: autocompleteStyle,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      // Defense en profondeur : on revalide la permission de l'appelant (en plus
      // de default_member_permissions, qui peut etre relache par un admin de guild).
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
        await interaction.reply({
          content: "❌ Tu n’as pas la permission de gérer les surnoms.",
          ephemeral: true,
        });
        return;
      }

      const style = interaction.options.getString("style", true);
      if (!estStyleConnu(style)) {
        await interaction.reply({
          content: messageErreur("style-inconnu", style),
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

      // Renommage temporaire (#38) : valide la duree AVANT tout edit (echec propre, aucun
      // renommage si la saisie est invalide). Absente => renommage permanent.
      const dureeSaisie = interaction.options.getString("duree");
      let expiresAt: number | undefined;
      if (dureeSaisie !== null) {
        const echeance = parserEcheance(dureeSaisie, Date.now());
        if (!echeance.ok) {
          await interaction.reply({ content: messageDureeInvalide(), ephemeral: true });
          return;
        }
        expiresAt = echeance.expiresAt;
      }

      const source = sourceRename(membre, interaction.options.getString("nouveau_nom"));

      // Si renommage temporaire : MEMORISER le pseudo source AVANT de styliser, avec
      // l'echeance, pour que le job de balayage le restaure (round-trip #25 reutilise).
      // Idempotent : ne pas ecraser un original deja memorise (auto-rename par role en cours).
      if (expiresAt !== undefined) {
        await originalNickStore.rememberIfAbsent(membre.guild.id, membre.id, source, expiresAt);
      }

      const resultat = await appliquerRename(membre, style, source);
      if (!resultat.ok) {
        // Le rename a echoue : on n'aura rien a reverter, on oublie l'echeance memorisee.
        if (expiresAt !== undefined) await originalNickStore.forget(membre.guild.id, membre.id);
        await interaction.reply({ content: resultat.message, ephemeral: true });
        return;
      }

      const embed = embedRenameOk(
        membre,
        resultat.pseudo,
        resultat.style,
        COULEUR_VERT,
        "✅ Membre renommé",
      );
      await interaction.reply({ embeds: [embed] });
    },
  };
}
