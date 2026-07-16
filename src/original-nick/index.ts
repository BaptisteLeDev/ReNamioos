/**
 * Composition de l'OriginalNickStore (issue #25) — point d'entree du pseudo d'origine.
 *
 * Branche le bon adapter selon la presence de DATABASE_URL (provenance UNIQUE du pseudo
 * d'origine), comme l'opt-out :
 *  - SANS url  => MemoryOriginalNickStore (dev, ephemere).
 *  - AVEC url  => NeonOriginalNickStore (cache + invalidation, persistant par serveur).
 *
 * Les queries Neon sont creees via getDb (init paresseuse du pool) sauf si on en injecte.
 */
import { getDb } from "../db/client";
import type { OriginalNickStore } from "./store";
import { creerNeonOriginalNickStore, type OriginalNickQueries } from "./neon-store";
import { creerNeonOriginalNickQueries } from "./neon-queries";
import { creerMemoryOriginalNickStore } from "./memory-store";

export type { OriginalNickStore } from "./store";

export interface OptionsOriginalNickStore {
  /** URL Postgres Neon. Absente => mode memoire (dev). */
  databaseUrl: string | undefined;
  /** Override des queries Neon (tests). Par defaut : creees via getDb(databaseUrl). */
  queries?: OriginalNickQueries;
}

export function creerOriginalNickStore(options: OptionsOriginalNickStore): OriginalNickStore {
  if (!options.databaseUrl) return creerMemoryOriginalNickStore();
  const queries = options.queries ?? creerNeonOriginalNickQueries(getDb(options.databaseUrl));
  return creerNeonOriginalNickStore(queries);
}
