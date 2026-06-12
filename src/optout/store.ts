/**
 * Port OptOutStore (issue #27) — PROVENANCE UNIQUE du consentement membre.
 *
 * Le membre peut REFUSER l'auto-rename sur lui (`/renamioos opt-out`). Ce port est le
 * SEUL endroit qui sait d'oU vient cet etat (Neon par serveur, ou memoire en dev) ;
 * les adapters Discord (commande /renamioos, evenement guildMemberUpdate) le consomment,
 * jamais la source brute (mandat ARCHITECTURE.md : un seul point sait d'oU vient la donnee).
 *
 * Cle = (guildId, memberId) : le consentement est PAR SERVEUR (un membre peut etre
 * opt-out sur un serveur, pas sur un autre). Minimisation D8 : une ligne n'existe QUE
 * si le membre est opt-out (l'etat par defaut = consentement, donc absence de ligne) ;
 * `optIn` supprime la ligne. La table reste minuscule (seuls les refus sont stockes).
 */
export interface OptOutStore {
  /** Le membre a-t-il refuse l'auto-rename sur ce serveur ? */
  isOptOut(guildId: string, memberId: string): Promise<boolean>;
  /** Enregistre le refus (idempotent : no-op si deja opt-out). */
  optOut(guildId: string, memberId: string): Promise<void>;
  /** Retire le refus = reactive l'auto-rename (idempotent : no-op si deja opt-in). */
  optIn(guildId: string, memberId: string): Promise<void>;
}
