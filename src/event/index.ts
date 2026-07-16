/**
 * Composition de l'EventStore (« Style Party ») — point d'entree du bounded context.
 *
 * Branche le bon adapter selon la presence de DATABASE_URL (provenance UNIQUE de l'event) :
 *  - SANS url  => MemoryEventStore (dev, ephemere).
 *  - AVEC url  => NeonEventStore (persistant par serveur ; cold-path, pas de cache).
 *
 * Les queries Neon sont creees via getDb (init paresseuse du pool) sauf si on en injecte.
 */
import { getDb } from "../db/client";
import type { EventStore } from "./store";
import { creerMemoryEventStore } from "./memory-store";
import { creerNeonEventStore, type EventQueries } from "./neon-store";
import { creerNeonEventQueries } from "./neon-queries";

export type { EventStore } from "./store";

export interface OptionsEventStore {
  /** URL Postgres Neon. Absente => mode memoire (dev). */
  databaseUrl: string | undefined;
  /** Override des queries Neon (tests). Par defaut : creees via getDb(databaseUrl). */
  queries?: EventQueries;
}

export function creerEventStore(options: OptionsEventStore): EventStore {
  if (!options.databaseUrl && !options.queries) return creerMemoryEventStore();
  const queries = options.queries ?? creerNeonEventQueries(getDb(options.databaseUrl));
  return creerNeonEventStore(queries);
}
