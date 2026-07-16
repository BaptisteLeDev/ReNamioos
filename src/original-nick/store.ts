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
  /**
   * Pose (ou RAFRAICHIT) une ECHEANCE temporaire (#38, audit). Contrairement a
   * `rememberIfAbsent` (idempotent, no-op si une ligne existe), ECRIT toujours l'echeance,
   * MEME si une ligne existe deja (ON CONFLICT DO UPDATE SET expires_at) : un membre deja
   * sous auto-rename par role peut recevoir un `/rename ... duree:` sans que l'echeance soit
   * perdue (sinon le rename « temporaire » resterait PERMANENT). Ne modifie JAMAIS le pseudo
   * d'origine d'une ligne existante (on garde le vrai original, pas le pseudo deja stylise
   * passe en argument). Renvoie `true` si une NOUVELLE ligne a ete creee (le `nick` fourni en
   * devient l'original), `false` si une ligne preexistait (seule l'echeance est mise a jour).
   * L'appelant s'en sert pour ne `forget()` sur echec QUE la ligne qu'il a lui-meme creee.
   */
  rememberWithDeadline(
    guildId: string,
    memberId: string,
    nick: string,
    expiresAt: number,
  ): Promise<boolean>;
  /** Oublie le pseudo memorise et son echeance (apres restauration). Idempotent. */
  forget(guildId: string, memberId: string): Promise<void>;
  /**
   * Lignes dont l'echeance est echue a `maintenant` (`expiresAt <= maintenant`) — issue #38.
   * Les lignes sans echeance (auto-rename par role) ne sont JAMAIS dues. Consommee par le
   * job de balayage qui restaure puis `forget`.
   */
  listDue(maintenant: number): Promise<Array<{ guildId: string; memberId: string; nick: string }>>;
  /**
   * Echeances temporaires A VENIR (`expiresAt > maintenant`) de CETTE guilde — issue #46,
   * `/rename pending`. Complementaire de `listDue` (echues) : ce que le job n'a pas encore
   * restaure. Exclut les lignes sans echeance (auto-rename par role, jamais « pending »).
   * L'ordre n'est pas garanti par le port (le tri par echeance est fait a l'affichage).
   */
  listPendingByGuild(
    guildId: string,
    maintenant: number,
  ): Promise<Array<{ memberId: string; nick: string; expiresAt: number }>>;
  /**
   * La ligne TEMPORAIRE (avec echeance) d'un membre, ou null si aucune — issue #46,
   * `/rename cancel`. Renvoie null pour une ligne SANS echeance (round-trip par role #25) :
   * annuler ne doit jamais oublier un original pilote par les roles. Distinct de `get`, qui
   * ignore la nature temporaire ou non de la ligne.
   */
  getPending(
    guildId: string,
    memberId: string,
  ): Promise<{ nick: string; expiresAt: number } | null>;
}
