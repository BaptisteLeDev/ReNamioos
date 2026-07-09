/**
 * Adapter Neon du port CommandSyncStore.
 *
 * Persiste l'instantane des commandes connues dans la table `guild_command_sync`.
 * Les requetes drizzle sont INJECTEES (CommandSyncQueries) pour rester testable sans
 * vraie DB : ce module ne connait que des promesses. Format : noms tries joints par
 * virgule (les noms de slash-commands n'en contiennent jamais).
 */
import type { CommandSyncStore } from "./store";

const SEP = ",";

/** Frontiere d'I/O injectable : tout l'acces Postgres passe par ces deux fonctions. */
export interface CommandSyncQueries {
  /** Renvoie la chaine `command_names` du serveur, ou null si aucune ligne. */
  select(guildId: string): Promise<string | null>;
  /** Upsert sur la PK guild_id : cree ou remplace l'instantane. */
  upsert(guildId: string, commandNames: string): Promise<void>;
}

export function creerNeonCommandSyncStore(queries: CommandSyncQueries): CommandSyncStore {
  return {
    async getKnown(guildId) {
      const raw = await queries.select(guildId);
      if (raw === null || raw.length === 0) return [];
      return raw.split(SEP);
    },
    async record(guildId, names) {
      await queries.upsert(guildId, [...names].join(SEP));
    },
  };
}
