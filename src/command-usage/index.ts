/**
 * Composition du CommandUsageStore (issue #27) — point d'entree du suivi d'usage.
 *
 * Branche le bon adapter selon la presence de DATABASE_URL (provenance UNIQUE), comme le
 * journal d'auto-rename :
 *  - SANS url  => MemoryCommandUsageStore (dev, ephemere).
 *  - AVEC url  => NeonCommandUsageStore (compteur par jour persiste + cache memoire).
 *
 * Les queries Neon sont creees via getDb (init paresseuse du pool) sauf injection (tests).
 */
import { getDb } from "../db/client";
import type { CommandUsageStore } from "./store";
import { creerNeonCommandUsageStore, type CommandUsageQueries } from "./neon-store";
import { creerCommandUsageQueries } from "./neon-queries";
import { creerMemoryCommandUsageStore } from "./memory-store";

export type { CommandUsageStore } from "./store";

export interface OptionsCommandUsageStore {
  /** URL Postgres Neon. Absente => mode memoire (dev). */
  databaseUrl: string | undefined;
  /** Override des queries Neon (tests). Par defaut : creees via getDb(databaseUrl). */
  queries?: CommandUsageQueries;
}

export function creerCommandUsageStore(options: OptionsCommandUsageStore): CommandUsageStore {
  if (!options.databaseUrl) {
    return creerMemoryCommandUsageStore();
  }
  const queries = options.queries ?? creerCommandUsageQueries(getDb(options.databaseUrl));
  return creerNeonCommandUsageStore(queries);
}
