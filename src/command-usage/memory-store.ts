/**
 * Adapter MEMOIRE du port CommandUsageStore (issue #27) — mode DEV, sans DATABASE_URL.
 *
 * Le suivi d'usage est une donnee d'execution : en dev on le tient EN MEMOIRE (ephemere,
 * perdu au redemarrage). `load` est un no-op (rien a hydrater). Le cache journalier
 * (creerCacheJournalier, partage avec l'adapter Neon) porte la logique de fenetre/tri.
 */
import type { CommandUsageStore } from './store';
import { creerCacheJournalier } from './cache-journalier';

export interface OptionsMemoryCommandUsage {
  /** Horloge injectable (tests) : determine le jour courant. Defaut : Date. */
  now?: () => Date;
}

export function creerMemoryCommandUsageStore(
  options: OptionsMemoryCommandUsage = {},
): CommandUsageStore {
  const cache = creerCacheJournalier(options.now ?? (() => new Date()));

  return {
    load() {
      return Promise.resolve();
    },
    record() {
      cache.incrementerJourCourant();
      return Promise.resolve();
    },
    commandsDaily() {
      return cache.serie();
    },
  };
}
