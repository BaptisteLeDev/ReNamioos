/**
 * Port CommandSyncStore — PROVENANCE UNIQUE de l'instantane "commandes connues" par
 * serveur (utilise par /update pour detecter les nouvelles commandes).
 *
 * Comme MappingStore (ADR-0005), la source varie : Neon par serveur en prod, fichier
 * JSON local en dev (sans DATABASE_URL). La commande /update consomme ce port, jamais
 * la source brute. Changer la source = changer l'adapter, rien d'autre.
 */
export interface CommandSyncStore {
  /** Noms de commandes enregistres a la derniere synchro de ce serveur ([] si jamais). */
  getKnown(guildId: string): Promise<string[]>;
  /** Enregistre l'instantane courant des commandes pour ce serveur (upsert). */
  record(guildId: string, names: readonly string[]): Promise<void>;
}
