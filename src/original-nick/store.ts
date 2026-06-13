/**
 * Port OriginalNickStore (issue #25) — PROVENANCE UNIQUE du pseudo d'origine memorise.
 *
 * Pour le ROUND-TRIP de l'auto-rename : quand le bot stylise le pseudo d'un membre (gain
 * d'un role mappe), il MEMORISE d'abord le pseudo source ; quand le membre perd son
 * dernier role mappe, il RESTAURE ce pseudo. Comme l'opt-out (issue #27), un seul endroit
 * sait d'oU vient cette donnee (Neon par serveur, ou memoire en dev) ; les adapters
 * Discord (evenement guildMemberUpdate) le consomment, jamais la source brute.
 *
 * Cle = (guildId, memberId) : un seul pseudo d'origine memorise par membre et par serveur.
 * Minimisation D8 : une ligne n'existe QUE tant qu'un membre est sous auto-rename actif ;
 * la restauration SUPPRIME la ligne (le pseudo a ete rendu, plus rien a memoriser). La
 * memorisation est idempotente sur la 1re stylisation (ne pas ecraser l'original par un
 * pseudo deja stylise lors d'une re-stylisation).
 *
 * RENOMMAGE TEMPORAIRE (issue #38) : la meme ligne porte une ECHEANCE optionnelle
 * (`expiresAt`, epoch ms). Absente (auto-rename par role #25) => revert pilote par la perte
 * du dernier role mappe, pas par le temps. Presente (`/rename ... duree:`) => un job de
 * balayage restaure le pseudo des l'echeance passee (`listDue`).
 */
export interface OriginalNickStore {
  /** Le pseudo d'origine memorise pour ce membre, ou null si aucun. */
  get(guildId: string, memberId: string): Promise<string | null>;
  /**
   * Memorise le pseudo source SI aucun n'est deja memorise (no-op sinon : preserve
   * l'original ET son echeance). `expiresAt` (epoch ms, #38) optionnel : absent => pas
   * de revert temporise (round-trip par role #25 inchange).
   */
  rememberIfAbsent(
    guildId: string,
    memberId: string,
    nick: string,
    expiresAt?: number,
  ): Promise<void>;
  /** Oublie le pseudo memorise et son echeance (apres restauration). Idempotent. */
  forget(guildId: string, memberId: string): Promise<void>;
  /**
   * Lignes dont l'echeance est echue a `maintenant` (`expiresAt <= maintenant`) — issue #38.
   * Les lignes sans echeance (auto-rename par role) ne sont JAMAIS dues. Consommee par le
   * job de balayage qui restaure puis `forget`.
   */
  listDue(maintenant: number): Promise<Array<{ guildId: string; memberId: string; nick: string }>>;
}
