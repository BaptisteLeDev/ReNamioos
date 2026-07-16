/**
 * Composition du GuildSettingsStore (socle de flotte) — point d'entree du bounded context.
 *
 * Branche le bon adapter selon la presence de DATABASE_URL (provenance UNIQUE des reglages
 * par serveur), comme les autres stores de ReNamioos, et l'enveloppe TOUJOURS dans le
 * decorateur de cache (lecture par guilde + garde de generation) :
 *  - SANS url  => cache(MemoryGuildSettingsStore)  (dev, ephemere).
 *  - AVEC url  => cache(NeonGuildSettingsStore)     (persistant par serveur).
 *
 * Les queries Neon sont creees via getDb (init paresseuse du pool) sauf si on en injecte.
 */
import { getDb } from "../db/client";
import type { GuildSettingsStore } from "./store";
import { creerCachedGuildSettingsStore } from "./cached-store";
import { creerMemoryGuildSettingsStore } from "./memory-store";
import { creerNeonGuildSettingsStore, type GuildSettingsQueries } from "./neon-store";
import { creerNeonGuildSettingsQueries } from "./neon-queries";

export type { GuildSettingsStore } from "./store";

export interface OptionsGuildSettingsStore {
  /** URL Postgres Neon. Absente => mode memoire (dev). */
  databaseUrl: string | undefined;
  /** TTL du cache lecture (ms). Defaut : 60 s (cf. cached-store). */
  ttlMs?: number;
  /** Override des queries Neon (tests). Par defaut : creees via getDb(databaseUrl). */
  queries?: GuildSettingsQueries;
}

export function creerGuildSettingsStore(options: OptionsGuildSettingsStore): GuildSettingsStore {
  const cacheOpts = options.ttlMs !== undefined ? { ttlMs: options.ttlMs } : {};
  if (!options.databaseUrl && !options.queries) {
    return creerCachedGuildSettingsStore(creerMemoryGuildSettingsStore(), cacheOpts);
  }
  const queries = options.queries ?? creerNeonGuildSettingsQueries(getDb(options.databaseUrl));
  return creerCachedGuildSettingsStore(creerNeonGuildSettingsStore(queries), cacheOpts);
}
