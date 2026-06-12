/**
 * Port AutoRenameLogStore (issue #28) — PROVENANCE UNIQUE du journal d'auto-rename.
 *
 * Trace les N derniers evenements d'auto-rename PAR GUILDE (succes/echec) pour le
 * diagnostic admin (`/auto-rename log`) et DERIVE le compteur d'echecs du jour expose
 * dans /stats. Comme l'opt-out (issue #27), un seul endroit sait d'oU vient la donnee
 * (Neon par serveur, ou memoire en dev) ; les adapters Discord/HTTP le consomment.
 *
 * `failuresToday()` est SYNCHRONE et sans I/O : le contrat /stats impose un getStats()
 * rapide (cf. api/contract.test.ts). Le store maintient donc un compteur en memoire,
 * incremente a chaque `record` d'un echec et remis a zero au changement de jour. Le
 * journal persistant (record/recent) sert le diagnostic ; le compteur sert la metrique.
 */
import type { AutoRenameLogEntry } from '../domain/auto-rename-log';

export interface AutoRenameLogStore {
  /** Enregistre un evenement (succes ou echec) et met a jour le compteur du jour. */
  record(entry: AutoRenameLogEntry): Promise<void>;
  /** Les `limite` evenements les plus recents de la guilde (recent -> ancien). */
  recent(guildId: string, limite: number): Promise<AutoRenameLogEntry[]>;
  /**
   * Nombre d'echecs depuis minuit (fuseau du bot). SYNCHRONE et sans I/O : alimente
   * `autoRenameFailuresToday` dans getStats(). Compteur en memoire, pas un round-trip.
   */
  failuresToday(): number;
}
