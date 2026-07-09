/**
 * Adapter Neon du port CommandUsageStore (issue #27).
 *
 * Persiste le compte de commandes PAR JOUR dans `command_daily` (Neon, upsert + 1). Au
 * boot, `load` hydrate le cache memoire avec les derniers jours (un seul round-trip) ;
 * ensuite `record` incremente Postgres ET le cache, et `commandsDaily` lit le CACHE
 * (synchrone, sans I/O) : getStats() reste rapide, invariant du contrat /stats.
 *
 * Les fonctions de requete sont INJECTEES (`CommandUsageQueries`) : le SQL/drizzle vit
 * dans neon-queries.ts ; ce module ne connait que des promesses (testable sans DB).
 */
import type { CommandUsageStore } from "./store";
import { creerCacheJournalier } from "./cache-journalier";
import { FENETRE_COMMANDS_DAILY_JOURS, type CompteJournalier } from "../domain/command-usage";

/** Frontiere d'I/O injectable : tout l'acces Postgres passe par ces deux fonctions. */
export interface CommandUsageQueries {
  /** Les comptes journaliers les plus recents (au moins la fenetre exposee par /stats). */
  selectDerniers(limite: number): Promise<CompteJournalier[]>;
  /** Upsert +1 sur le compte du jour `day` (format "AAAA-MM-JJ" UTC). */
  incrementJour(day: string): Promise<void>;
}

export interface OptionsNeonCommandUsage {
  /** Horloge injectable (tests) : determine le jour courant. Defaut : Date. */
  now?: () => Date;
}

export function creerNeonCommandUsageStore(
  queries: CommandUsageQueries,
  options: OptionsNeonCommandUsage = {},
): CommandUsageStore {
  const now = options.now ?? (() => new Date());
  const cache = creerCacheJournalier(now);

  return {
    async load() {
      const derniers = await queries.selectDerniers(FENETRE_COMMANDS_DAILY_JOURS);
      cache.hydrater(derniers);
    },
    async record() {
      const jour = cache.incrementerJourCourant();
      await queries.incrementJour(jour);
    },
    commandsDaily() {
      return cache.serie();
    },
  };
}
