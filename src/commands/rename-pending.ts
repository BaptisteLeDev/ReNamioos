/**
 * Commande /rename-pending — liste les renommages TEMPORAIRES a venir (issue #46, F1).
 *
 * Contrepartie « lecture » de `/rename ... duree:` : montre a un admin les echeances de
 * revert encore À VENIR sur SA guilde (membre, pseudo original a restaurer, date), triees
 * par echeance. La provenance reste unique (OriginalNickStore #25/#38) ; cette commande ne
 * fait que LIRE via `listPendingByGuild`. Les lignes deja echues relevent du job de balayage
 * (src/jobs/sweep-temporaire), pas de cet affichage.
 *
 * Choix #46 : commande SEPAREE (`/rename-pending`) plutot qu'un sous-groupe `/rename pending`.
 * Discord interdit qu'une commande plate `/rename` (options membre/style/duree) coexiste avec
 * un groupe de sous-commandes du meme nom ; convertir `/rename` en groupe casserait l'UX et
 * les tests existants. Meme garde de permission (Manage Nicknames) que le reste de l'admin.
 */
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "./types";
import type { OriginalNickStore } from "../original-nick/store";

/** Formate une ligne d'echeance en Markdown Discord (mention + pseudo cible + date). */
function ligneEcheance(memberId: string, nick: string, expiresAt: number): string {
  const secondes = Math.floor(expiresAt / 1000);
  // `<t:...:f>` = date/heure locale du lecteur ; `<t:...:R>` = relatif (« dans 2 h »).
  return `• <@${memberId}> → **${nick}** — expire <t:${secondes}:f> (<t:${secondes}:R>)`;
}

export function creerRenamePendingCommand(
  originalNickStore: OriginalNickStore,
  maintenant: () => number = Date.now,
): Command {
  return {
    data: new SlashCommandBuilder()
      .setName("rename-pending")
      .setDescription("Liste les renommages temporaires à venir sur ce serveur.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      // Defense en profondeur : meme garde que /rename (default_member_permissions peut
      // etre relache par un admin de guild).
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
        await interaction.reply({
          content: "❌ Tu n’as pas la permission de gérer les surnoms.",
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({
          content: "❌ Cette commande doit être utilisée sur un serveur.",
          ephemeral: true,
        });
        return;
      }

      const pending = await originalNickStore.listPendingByGuild(guildId, maintenant());
      if (pending.length === 0) {
        await interaction.reply({
          content: "ℹ️ Aucun renommage temporaire en attente sur ce serveur.",
          ephemeral: true,
        });
        return;
      }

      // Tri (presentation) par echeance croissante : la plus proche en premier.
      const triees = [...pending].sort((a, b) => a.expiresAt - b.expiresAt);
      const entete = `⏳ **Renommages temporaires en attente (${pending.length})**`;

      // Borne l'affichage sous la limite Discord de 2000 caracteres (robustesse #46) : au-dela
      // d'une trentaine d'echeances (pseudos jusqu'a 32 code points), le contenu depasserait la
      // limite et `reply` leverait un DiscordAPIError non capture. On accumule les lignes tant
      // qu'on tient sous un budget avec marge, puis on signale le reste non affiche.
      const BUDGET = 1_900;
      const lignes: string[] = [];
      let taille = entete.length;
      for (const p of triees) {
        const ligne = ligneEcheance(p.memberId, p.nick, p.expiresAt);
        if (taille + 1 + ligne.length > BUDGET) break;
        lignes.push(ligne);
        taille += 1 + ligne.length;
      }
      const reste = triees.length - lignes.length;
      const corps = [entete, ...lignes];
      if (reste > 0) corps.push(`… et ${reste} autre(s) échéance(s) non affichée(s).`);

      await interaction.reply({ content: corps.join("\n"), ephemeral: true });
    },
  };
}
