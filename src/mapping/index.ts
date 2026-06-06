/**
 * Composition du MappingStore (B8, ADR-0005) — point d'entree du bounded context.
 *
 * Branche le bon adapter selon la presence de DATABASE_URL (provenance UNIQUE de la
 * config auto-rename) :
 *  - SANS url  => FileMappingStore seul (mode dev, lecture seule).
 *  - AVEC url  => CompositeMappingStore = NeonMappingStore (cache + invalidation)
 *                 + FALLBACK lecture sur le fichier tant qu'une guild n'a rien en
 *                 base (transition documentee, issue #19).
 *
 * Les queries Neon sont creees ici via getDb (init paresseuse du Pool) sauf si on en
 * injecte (tests : aucune connexion Postgres reelle).
 */
import type { MappingRoleStyle } from '../domain/auto-rename';
import { getDb } from '../db/client';
import type { MappingStore } from './store';
import { creerNeonMappingStore, type MappingQueries } from './neon-store';
import { creerNeonQueries } from './neon-queries';
import { creerFileMappingStore } from './file-store';
import { creerCompositeMappingStore } from './composite-store';

export type { MappingStore } from './store';

export interface OptionsMappingStore {
  /** URL Postgres Neon. Absente => mode fichier (dev). */
  databaseUrl: string | undefined;
  /** Mapping fichier deja charge+valide (src/config/auto-rename-config.ts). */
  mappingFichier: MappingRoleStyle;
  /** Override des queries Neon (tests). Par defaut : creees via getDb(databaseUrl). */
  queries?: MappingQueries;
}

export function creerMappingStore(options: OptionsMappingStore): MappingStore {
  const fichier = creerFileMappingStore(options.mappingFichier);
  if (!options.databaseUrl) return fichier;

  const queries = options.queries ?? creerNeonQueries(getDb(options.databaseUrl));
  const neon = creerNeonMappingStore(queries);
  return creerCompositeMappingStore(neon, fichier);
}
