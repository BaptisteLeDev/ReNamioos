/**
 * Composition de l'AutoRenameLogStore (issue #28) — point d'entree du journal.
 *
 * Branche le bon adapter selon la presence de DATABASE_URL (provenance UNIQUE du
 * journal), comme l'opt-out :
 *  - SANS url  => MemoryAutoRenameLogStore (dev, ephemere).
 *  - AVEC url  => NeonAutoRenameLogStore (ring-buffer DB + compteur memoire).
 *
 * Pas de composite/fallback (le journal n'a pas de source fichier). Les queries Neon
 * sont creees via getDb (init paresseuse du pool) sauf si on en injecte (tests).
 */
import { getDb } from "../db/client";
import type { AutoRenameLogStore } from "./store";
import { creerNeonAutoRenameLogStore, type AutoRenameLogQueries } from "./neon-store";
import { creerNeonAutoRenameLogQueries } from "./neon-queries";
import { creerMemoryAutoRenameLogStore } from "./memory-store";

export type { AutoRenameLogStore } from "./store";

/** Capacite du ring-buffer par guilde (les N derniers evenements). Minimisation D8. */
export const CAPACITE_JOURNAL_PAR_GUILD = 50;

export interface OptionsAutoRenameLogStore {
  /** URL Postgres Neon. Absente => mode memoire (dev). */
  databaseUrl: string | undefined;
  /** Override des queries Neon (tests). Par defaut : creees via getDb(databaseUrl). */
  queries?: AutoRenameLogQueries;
}

export function creerAutoRenameLogStore(options: OptionsAutoRenameLogStore): AutoRenameLogStore {
  if (!options.databaseUrl) {
    return creerMemoryAutoRenameLogStore({ capaciteParGuild: CAPACITE_JOURNAL_PAR_GUILD });
  }
  const queries = options.queries ?? creerNeonAutoRenameLogQueries(getDb(options.databaseUrl));
  return creerNeonAutoRenameLogStore(queries, { capaciteParGuild: CAPACITE_JOURNAL_PAR_GUILD });
}
