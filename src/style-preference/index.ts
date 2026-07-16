/**
 * Composition du StylePreferenceStore — point d'entree du bounded context.
 *
 * Branche le bon adapter selon la presence de DATABASE_URL (provenance UNIQUE de la
 * signature de style), comme l'opt-out :
 *  - SANS url  => MemoryStylePreferenceStore (dev, ephemere).
 *  - AVEC url  => NeonStylePreferenceStore (cache + invalidation, persistant par serveur).
 *
 * Les queries Neon sont creees via getDb (init paresseuse du pool) sauf si on en injecte.
 */
import { getDb } from "../db/client";
import type { StylePreferenceStore } from "./store";
import { creerMemoryStylePreferenceStore } from "./memory-store";
import { creerNeonStylePreferenceStore, type StylePreferenceQueries } from "./neon-store";
import { creerNeonStylePreferenceQueries } from "./neon-queries";

export type { StylePreferenceStore } from "./store";

export interface OptionsStylePreferenceStore {
  /** URL Postgres Neon. Absente => mode memoire (dev). */
  databaseUrl: string | undefined;
  /** Override des queries Neon (tests). Par defaut : creees via getDb(databaseUrl). */
  queries?: StylePreferenceQueries;
}

export function creerStylePreferenceStore(
  options: OptionsStylePreferenceStore,
): StylePreferenceStore {
  if (!options.databaseUrl && !options.queries) return creerMemoryStylePreferenceStore();
  const queries =
    options.queries ?? creerNeonStylePreferenceQueries(getDb(options.databaseUrl));
  return creerNeonStylePreferenceStore(queries);
}
