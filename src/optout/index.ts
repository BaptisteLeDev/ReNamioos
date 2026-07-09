/**
 * Composition de l'OptOutStore (issue #27) — point d'entree du consentement membre.
 *
 * Branche le bon adapter selon la presence de DATABASE_URL (provenance UNIQUE du
 * consentement) :
 *  - SANS url  => MemoryOptOutStore (dev, ephemere).
 *  - AVEC url  => NeonOptOutStore (cache + invalidation, persistant par serveur).
 *
 * Pas de composite/fallback ici (contrairement au mapping) : le consentement n'a pas de
 * source fichier, le defaut est simplement « pas opt-out ». Les queries Neon sont creees
 * via getDb (init paresseuse du pool) sauf si on en injecte (tests : aucune connexion).
 */
import { getDb } from "../db/client";
import type { OptOutStore } from "./store";
import { creerNeonOptOutStore, type OptOutQueries } from "./neon-store";
import { creerNeonOptOutQueries } from "./neon-queries";
import { creerMemoryOptOutStore } from "./memory-store";

export type { OptOutStore } from "./store";

export interface OptionsOptOutStore {
  /** URL Postgres Neon. Absente => mode memoire (dev). */
  databaseUrl: string | undefined;
  /** Override des queries Neon (tests). Par defaut : creees via getDb(databaseUrl). */
  queries?: OptOutQueries;
}

export function creerOptOutStore(options: OptionsOptOutStore): OptOutStore {
  if (!options.databaseUrl) return creerMemoryOptOutStore();
  const queries = options.queries ?? creerNeonOptOutQueries(getDb(options.databaseUrl));
  return creerNeonOptOutStore(queries);
}
