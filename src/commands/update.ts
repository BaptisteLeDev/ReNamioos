/**
 * Commande /update — reservee aux admins (ManageGuild).
 *
 * Re-synchronise les slash-commands du bot sur le SERVEUR COURANT (guildId) via
 * l'API Discord pour une disponibilite instantanee (pas d'attente de la propagation
 * globale), puis repond un embed ephemere : nombre + liste des commandes, et met en
 * evidence les NOUVELLES depuis la derniere synchro de ce serveur.
 *
 * Dependances INJECTEES (fabrique) pour garder l'adapter testable :
 *  - `store` : provenance des commandes connues par serveur (Neon ou fichier dev) ;
 *  - `redeploy(guildId, payload)` : effectue le PUT REST (I/O Discord isolee) ;
 *  - `commandsRef()` : renvoie le registre courant (data des commandes), /update incluse.
 *
 * La detection des nouvelles commandes (diff) est PURE et testee sans I/O (command-sync.ts).
 */
import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";
import type { Command } from "./types";
import type { CommandSyncStore } from "../command-sync/store";
import { diffCommands } from "./command-sync";

export interface OptionsUpdateCommand {
  store: CommandSyncStore;
  /** PUT REST des commandes sur la guild. I/O Discord isolee (testable via fake). */
  redeploy(guildId: string, payload: RESTPostAPIApplicationCommandsJSONBody[]): Promise<void>;
  /** Registre courant des commandes (schemas), /update incluse. Lazy pour casser le cycle. */
  commandsRef(): readonly Command[];
}

const COULEUR_VERT = 0x2ecc71;

export function creerUpdateCommand(options: OptionsUpdateCommand): Command {
  const { store, redeploy, commandsRef } = options;

  return {
    data: new SlashCommandBuilder()
      .setName("update")
      .setDescription("Re-synchronise les commandes sur ce serveur (admin).")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const guildId = interaction.guildId;
      if (guildId === null) {
        await interaction.reply({
          content: "❌ Cette commande doit être utilisée sur un serveur.",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const registre = commandsRef();
      const payload = registre.map((c) => c.data.toJSON());
      const availableNow = registre.map((c) => c.data.name);

      let known: string[] = [];
      try {
        known = await store.getKnown(guildId);
      } catch (err) {
        console.warn(`/update : lecture des commandes connues echouee (${guildId}) :`, err);
      }

      try {
        await redeploy(guildId, payload);
      } catch (err) {
        console.error(`/update : re-synchro echouee (${guildId}) :`, err);
        await interaction.editReply({
          content: "❌ La re-synchronisation a échoué. Réessaie dans un moment.",
        });
        return;
      }

      const diff = diffCommands(availableNow, known);

      try {
        await store.record(guildId, diff.available);
      } catch (err) {
        console.warn(`/update : enregistrement de la synchro echoue (${guildId}) :`, err);
      }

      const sectionNouvelles =
        diff.added.length > 0
          ? `\n\n🆕 **Nouvelles** (${diff.added.length}) : ${diff.added.map((n) => `\`/${n}\``).join(", ")}`
          : "\n\n✅ Aucune nouvelle commande depuis la dernière synchro.";

      const embed = new EmbedBuilder()
        .setTitle("🔄 Commandes synchronisées")
        .setColor(COULEUR_VERT)
        .setDescription(
          `**${diff.available.length}** commande(s) disponible(s) sur ce serveur :\n` +
            diff.available.map((n) => `\`/${n}\``).join(", ") +
            sectionNouvelles,
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  };
}
