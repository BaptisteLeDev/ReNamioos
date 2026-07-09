/**
 * Commande /auto-rename — config auto-rename PAR SERVEUR (B8, ADR-0005).
 *
 * ADAPTER Discord d'administration : traduit l'interaction vers le port MappingStore
 * (provenance unique rOle -> style) et repose le resultat. Aucune logique de
 * persistance ici (le store la porte) ; aucune regle de stylisation (le domaine la
 * porte). La commande se limite a : verifier la permission, extraire les primitives
 * (guildId, roleId, style), appeler le store, confirmer.
 *
 * Permission : ManageGuild (config serveur). default_member_permissions cable la
 * visibilite par defaut ; on REVALIDE dans execute (defense en profondeur, un admin
 * de guild peut relacher la permission par defaut). Refus PROPRE en ephemeral.
 *
 * Sous-commandes :
 *  - add <role> <style> : mappe un rOle natif a un style (choix natifs = STYLE_NAMES).
 *  - remove <role>      : retire le mapping d'un rOle.
 *  - list               : liste les mappings de la guild, avec apercu (apercuStyle).
 *  - log                : journal des derniers auto-renames de la guild (issue #28),
 *                         lu via AutoRenameLogStore (provenance unique du journal).
 */
import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { STYLE_NAMES } from "../domain/styles";
import type { MappingStore } from "../mapping/store";
import type { AutoRenameLogStore } from "../auto-rename-log/store";
import type { AutoRenameLogEntry } from "../domain/auto-rename-log";
import type { Command } from "./types";
import { COULEUR_VIOLET } from "./couleurs";
import {
  apercuStyle,
  avertissementFaisabilite,
  capitaliser,
  estStyleConnu,
  messageErreur,
} from "./styliser";

/** Nombre d'evenements affiches par /auto-rename log (les plus recents). */
const LIMITE_LOG = 10;

/** Fabrique /auto-rename : les stores (provenance) sont injectes a la composition. */
export function creerAutoRenameCommand(store: MappingStore, logStore: AutoRenameLogStore): Command {
  return {
    data: new SlashCommandBuilder()
      .setName("auto-rename")
      .setDescription("Configure l’auto-rename de ce serveur (rôle → style).")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Mappe un rôle à un style (appliqué au gain du rôle).")
          .addRoleOption((opt) =>
            opt.setName("role").setDescription("Le rôle à mapper").setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName("style")
              .setDescription("Le style à appliquer")
              .setRequired(true)
              .addChoices(...STYLE_NAMES.map((s) => ({ name: capitaliser(s), value: s }))),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Retire le mapping d’un rôle.")
          .addRoleOption((opt) =>
            opt.setName("role").setDescription("Le rôle à démapper").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("Liste les mappings rôle → style de ce serveur."),
      )
      .addSubcommand((sub) =>
        sub
          .setName("log")
          .setDescription("Affiche les derniers auto-renames (succès/échec) de ce serveur."),
      ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.guildId) {
        await interaction.reply({
          content: "❌ Cette commande s’utilise sur un serveur.",
          ephemeral: true,
        });
        return;
      }
      // Defense en profondeur : on revalide ManageGuild (en plus de la perm par defaut).
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: "❌ Tu n’as pas la permission de gérer ce serveur (Manage Server).",
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.guildId;
      const sub = interaction.options.getSubcommand();

      if (sub === "add") {
        const role = interaction.options.getRole("role", true);
        const style = interaction.options.getString("style", true);
        if (!estStyleConnu(style)) {
          await interaction.reply({
            content: messageErreur("style-inconnu", style),
            ephemeral: true,
          });
          return;
        }
        await store.add(guildId, role.id, style);
        const embed = new EmbedBuilder()
          .setTitle("✅ Mapping enregistré")
          .setColor(COULEUR_VIOLET)
          .addFields(
            { name: "🎭 Rôle", value: role.toString(), inline: true },
            { name: "🎨 Style", value: capitaliser(style), inline: true },
            { name: "👀 Aperçu", value: apercuStyle(style), inline: false },
          );
        // #29 : on PREVIENT (sans bloquer) si le bot ne pourra pas appliquer ce style.
        const alerte = avertissementFaisabilite(interaction.guild?.members.me ?? null, role);
        if (alerte) {
          embed.addFields({ name: "⚠️ Faisabilité", value: alerte, inline: false });
        }
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (sub === "remove") {
        const role = interaction.options.getRole("role", true);
        await store.remove(guildId, role.id);
        const embed = new EmbedBuilder()
          .setTitle("🗑️ Mapping retiré")
          .setColor(COULEUR_VIOLET)
          .addFields({ name: "🎭 Rôle", value: role.toString(), inline: true });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (sub === "log") {
        const evenements = await logStore.recent(guildId, LIMITE_LOG);
        if (evenements.length === 0) {
          await interaction.reply({
            content:
              "ℹ️ Aucun auto-rename enregistré sur ce serveur pour le moment. " +
              "Le journal se remplit quand un membre gagne un rôle mappé.",
            ephemeral: true,
          });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle("📜 Journal d’auto-rename")
          .setColor(COULEUR_VIOLET)
          .setDescription(`Les ${evenements.length} derniers événements (récent → ancien).`)
          .addFields(evenements.map(ligneJournal));
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // sub === 'list'
      const mapping = await store.list(guildId);
      const entrees = Object.entries(mapping);
      if (entrees.length === 0) {
        await interaction.reply({
          content:
            "ℹ️ Aucun mapping auto-rename sur ce serveur. Ajoute-en un avec `/auto-rename add`.",
          ephemeral: true,
        });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle("🎭 Auto-rename de ce serveur")
        .setColor(COULEUR_VIOLET)
        .setDescription("Ordre = priorité quand plusieurs rôles sont gagnés d’un coup.")
        .addFields(
          entrees.map(([roleId, style]) => ({
            name: capitaliser(style),
            value: `<@&${roleId}> → ${apercuStyle(style)}`,
            inline: false,
          })),
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
}

/** Une ligne d'embed pour un evenement du journal (issue #28) : statut + membre + detail. */
function ligneJournal(e: AutoRenameLogEntry): { name: string; value: string; inline: boolean } {
  const icone = e.outcome === "succes" ? "✅" : "❌";
  const quand = e.at.toISOString().replace("T", " ").slice(0, 16); // AAAA-MM-JJ hh:mm
  return {
    name: `${icone} ${capitaliser(e.style)} · ${quand} UTC`,
    value: `<@${e.memberId}> — ${e.detail}`,
    inline: false,
  };
}
