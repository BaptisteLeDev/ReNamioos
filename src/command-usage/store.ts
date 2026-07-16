/**
 * Port CommandUsageStore (issue #27) — PROVENANCE UNIQUE du suivi d'usage des commandes.
 *
 * Compte les commandes executees PAR JOUR (UTC) pour alimenter la serie `commandsDaily`
 * de /stats (30 derniers jours). Comme le journal d'auto-rename (issue #28), un seul
 * endroit sait d'oU vient la donnee (Neon en prod, memoire en dev) ; le dispatch Discord
 * (client.ts) l'alimente, l'adapter HTTP (getStats) la consomme.
 *
 * `commandsDaily()` est SYNCHRONE et sans I/O : le contrat /stats impose un getStats()
 * rapide (cf. api/contract.test.ts). Le store tient donc un CACHE MEMOIRE des comptes
 * journaliers (hydrate au boot via `load`, incremente a chaque `record`). La persistance
 * (Neon) sert la survie aux redemarrages ; le cache sert la metrique synchrone.
 */
import type { CompteJournalier } from "../domain/command-usage";

export interface CommandUsageStore {
  /**
   * Hydrate le cache memoire depuis la source persistante (un round-trip, au boot).
   * No-op en mode memoire. A appeler avant de servir /stats en mode Neon.
   */
  load(): Promise<void>;
  /** Compte une commande executee maintenant : persiste (async) et met a jour le cache. */
  record(): Promise<void>;
  /**
   * Serie des 30 derniers jours (UTC), ascendant, `[]` si rien. SYNCHRONE et sans I/O :
   * lue depuis le cache memoire, pas un round-trip. Alimente `commandsDaily` de /stats.
   */
  commandsDaily(): CompteJournalier[];
}
