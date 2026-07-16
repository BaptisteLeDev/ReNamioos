/**
 * Commande /random <membre> [nouveau_nom] — renomme avec un style ALEATOIRE.
 *
 * Successeur de random_slash (bot.py:344). Choisit un style au hasard parmi les
 * 9, puis delegue au MEME flux partage que /rename (appliquerRename). Pas de
 * check de style (toujours valide). Memes erreurs propres (permission appelant,
 * hierarchie, refus propre, Forbidden bot) — ÉCART VOLONTAIRE B4 (ADR-0003 d.3).
 */
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { STYLE_NAMES, type StyleName } from "../domain/styles";
import type { Command } from "./types";
import { COULEUR_VIOLET } from "./couleurs";
import { appliquerRename, embedRenameOk, sourceRename } from "./styliser";
import { creerCompteurFenetre, type CompteurFenetre } from "../limitation/compteur-fenetre";
import { FENETRE_RENOMMAGE_MS, LIMITE_RENOMMAGE_PAR_INVOCATEUR } from "../domain/fenetre-glissante";
import { consommerCooldownOuMessage } from "./cooldown-rename";

/** Tire un style au hasard parmi les 9 (extrait pour rester trivial et lisible). */
function styleAleatoire(): StyleName {
  const i = Math.floor(Math.random() * STYLE_NAMES.length);
  return STYLE_NAMES[i]!;
}

/** Compteur de cooldown par défaut si la composition n'en injecte pas (cf. rename.ts). */
function cooldownParDefaut(): CompteurFenetre {
  return creerCompteurFenetre({
    limite: LIMITE_RENOMMAGE_PAR_INVOCATEUR,
    fenetreMs: FENETRE_RENOMMAGE_MS,
  });
}

/**
 * Fabrique /random. Reçoit le compteur de cooldown (B1) PARTAGÉ avec /rename à la
 * composition (src/client.ts) : la limite de 3 renommages/60 s couvre les deux commandes
 * pour un même invocateur+guilde.
 */
export function creerRandomCommand(cooldown: CompteurFenetre = cooldownParDefaut()): Command {
  return {
    data: new SlashCommandBuilder()
      .setName("random")
      .setDescription("Renomme un membre avec un style aléatoire.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
      .addUserOption((opt) =>
        opt.setName("membre").setDescription("Le membre à renommer").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("nouveau_nom").setDescription("Nouveau nom (optionnel ; sinon nom actuel)"),
      ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
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

      // Cooldown anti mass-rename (B1) : partagé avec /rename. Le jeton est consommé
      // ATOMIQUEMENT ici, AVANT l'await member.edit, pour qu'une rafale concurrente ne
      // franchisse pas toutes le check avant le 1er enregistrement (TOCTOU, cf. rename.ts).
      const messageCooldown = consommerCooldownOuMessage(cooldown, interaction);
      if (messageCooldown !== null) {
        await interaction.reply({ content: messageCooldown, ephemeral: true });
        return;
      }

      const style = styleAleatoire();
      const source = sourceRename(membre, interaction.options.getString("nouveau_nom"));
      const resultat = await appliquerRename(membre, style, source);
      if (!resultat.ok) {
        await interaction.reply({ content: resultat.message, ephemeral: true });
        return;
      }

      const embed = embedRenameOk(
        membre,
        resultat.pseudo,
        resultat.style,
        COULEUR_VIOLET,
        "🎲 Membre renommé (aléatoire)",
      );
      await interaction.reply({ embeds: [embed] });
    },
  };
}
