/**
 * Cache memoire des comptes journaliers de commandes (issue #27) — partage par les
 * adapters memoire et Neon du suivi d'usage.
 *
 * Maintient une Map `jour UTC -> count` pour alimenter `commandsDaily` dans getStats()
 * SANS round-trip (le contrat /stats exige un getStats() synchrone, cf.
 * api/contract.test.ts). La fenetre exposee (30 jours) et le tri ascendant sont
 * delegues a la logique pure `agregerCommandsDaily`. Hydrate au boot puis incremente a
 * chaque commande : un seul endroit decide « quel est le jour courant ? » (horloge
 * injectee), donc identique pour les deux adapters.
 */
import { agregerCommandsDaily, cleJourUtc, type CompteJournalier } from "../domain/command-usage";

export interface CacheJournalier {
  /** Remplace le contenu du cache (hydratation au boot depuis la source persistante). */
  hydrater(comptes: readonly CompteJournalier[]): void;
  /** Incremente le compteur du jour courant (selon l'horloge). Renvoie la cle du jour. */
  incrementerJourCourant(): string;
  /** Serie des 30 derniers jours (UTC), ascendant, [] si rien. */
  serie(): CompteJournalier[];
}

export function creerCacheJournalier(now: () => Date): CacheJournalier {
  const parJour = new Map<string, number>();

  return {
    hydrater(comptes) {
      parJour.clear();
      for (const c of comptes) parJour.set(c.day, c.count);
    },
    incrementerJourCourant() {
      const jour = cleJourUtc(now());
      parJour.set(jour, (parJour.get(jour) ?? 0) + 1);
      return jour;
    },
    serie() {
      const comptes = [...parJour].map(([day, count]) => ({ day, count }));
      return agregerCommandsDaily(comptes, now());
    },
  };
}
