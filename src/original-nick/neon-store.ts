/**
 * Adapter Neon du port OriginalNickStore (issue #25).
 *
 * Persiste le pseudo d'origine dans la table `auto_rename_original_nicks` (Neon), derriere
 * un CACHE en memoire PAR GUILD (Map memberId -> nick). Le cache evite un round-trip
 * Postgres dans le chemin chaud (guildMemberUpdate, appele a chaque changement de role) ;
 * il est INVALIDE de facon ciblee a chaque ecriture (rememberIfAbsent / forget).
 *
 * Minimisation D8 : une ligne n'existe QUE tant qu'un membre est stylise ; `forget`
 * SUPPRIME la ligne apres restauration. `rememberIfAbsent` n'ecrase jamais un original
 * deja memorise (ON CONFLICT DO NOTHING cote SQL).
 *
 * Les fonctions de requete sont INJECTEES (`OriginalNickQueries`) : le SQL/drizzle vit
 * dans neon-queries.ts ; ce module ne connait que des promesses (testable sans DB).
 */
import type { OriginalNickStore } from "./store";

/** Frontiere d'I/O injectable : tout l'acces Postgres passe par ces fonctions. */
export interface OriginalNickQueries {
  /** Tous les (memberId, nick) memorises de la guild. */
  selectByGuild(guildId: string): Promise<Array<{ memberId: string; nick: string }>>;
  /**
   * Insere le pseudo SI absent (ON CONFLICT DO NOTHING : ne pas ecraser l'original ni son
   * echeance). `expiresAt` (epoch ms, #38) optionnel : absent => colonne NULL (pas de revert
   * temporise).
   */
  upsertIfAbsent(
    guildId: string,
    memberId: string,
    nick: string,
    expiresAt?: number,
  ): Promise<void>;
  /**
   * Insere la ligne AVEC echeance, ou (si elle existe deja) met a jour SEULEMENT `expires_at`
   * (ON CONFLICT DO UPDATE SET expires_at) — #38, audit. Ne touche jamais `original_nick`
   * d'une ligne existante. N'indique pas insert vs update : le store lit l'etat prealable.
   */
  upsertWithDeadline(
    guildId: string,
    memberId: string,
    nick: string,
    expiresAt: number,
  ): Promise<void>;
  /** Supprime la ligne (guild, membre) si elle existe. */
  deleteOne(guildId: string, memberId: string): Promise<void>;
  /**
   * Lignes echues (`expires_at <= maintenant`) TOUTES guildes confondues (#38). Lecture
   * directe en DB (le cache par guild ne couvre pas une requete cross-guild par echeance).
   */
  selectDue(
    maintenant: number,
  ): Promise<Array<{ guildId: string; memberId: string; nick: string }>>;
  /**
   * Echeances A VENIR (`expires_at > maintenant`) d'une guilde (#46). Lecture directe :
   * le cache par guild (memberId -> nick) ne porte pas l'echeance.
   */
  selectPendingByGuild(
    guildId: string,
    maintenant: number,
  ): Promise<Array<{ memberId: string; nick: string; expiresAt: number }>>;
  /** La ligne d'un membre AVEC son echeance (ou null / echeance null) (#46). */
  selectOneWithExpiry(
    guildId: string,
    memberId: string,
  ): Promise<{ nick: string; expiresAt: number | null } | null>;
}

export function creerNeonOriginalNickStore(queries: OriginalNickQueries): OriginalNickStore {
  // Cache PAR guild : memberId -> pseudo d'origine. Absence de cle = jamais charge.
  const cache = new Map<string, Map<string, string>>();
  // Generation PAR guild (audit) : voir NeonMappingStore. Un read en vol ne peuple le cache
  // que si aucune invalidation n'est survenue pendant l'await (sinon snapshot perime cache).
  const generation = new Map<string, number>();
  const genDe = (guildId: string) => generation.get(guildId) ?? 0;
  function invalider(guildId: string): void {
    generation.set(guildId, genDe(guildId) + 1);
    cache.delete(guildId);
  }

  async function nicksDeGuild(guildId: string): Promise<Map<string, string>> {
    const enCache = cache.get(guildId);
    if (enCache) return enCache;
    const genAuDepart = genDe(guildId);
    const lignes = await queries.selectByGuild(guildId);
    const m = new Map(lignes.map((l) => [l.memberId, l.nick]));
    // Ne peupler le cache que si aucune invalidation n'est survenue pendant le read.
    if (genDe(guildId) === genAuDepart) cache.set(guildId, m);
    return m;
  }

  return {
    async get(guildId, memberId) {
      return (await nicksDeGuild(guildId)).get(memberId) ?? null;
    },

    async rememberIfAbsent(guildId, memberId, nick, expiresAt) {
      await queries.upsertIfAbsent(guildId, memberId, nick, expiresAt);
      invalider(guildId); // invalidation ciblee + bump de generation
    },

    async rememberWithDeadline(guildId, memberId, nick, expiresAt) {
      // Lit l'etat prealable pour savoir si on CREE (created=true) ou si on rafraichit une
      // ligne existante (created=false) : l'appelant ne forget() sur echec que ce qu'il a cree.
      const existante = await queries.selectOneWithExpiry(guildId, memberId);
      await queries.upsertWithDeadline(guildId, memberId, nick, expiresAt);
      invalider(guildId); // invalidation ciblee (l'echeance/le nick ont pu changer)
      return existante === null;
    },

    async forget(guildId, memberId) {
      await queries.deleteOne(guildId, memberId);
      invalider(guildId); // invalidation ciblee + bump de generation
    },

    listDue(maintenant) {
      // Lecture directe : le cache par guild (memberId -> nick) ne couvre pas une requete
      // cross-guild par echeance. Le job de balayage est peu frequent (pas le chemin chaud).
      return queries.selectDue(maintenant);
    },

    listPendingByGuild(guildId, maintenant) {
      // Lecture directe : le cache ne porte pas l'echeance ; /rename pending est peu frequent.
      return queries.selectPendingByGuild(guildId, maintenant);
    },

    async getPending(guildId, memberId) {
      const ligne = await queries.selectOneWithExpiry(guildId, memberId);
      // Seule une ligne AVEC echeance est « temporaire » (annulable via /rename cancel).
      if (!ligne || ligne.expiresAt === null) return null;
      return { nick: ligne.nick, expiresAt: ligne.expiresAt };
    },
  };
}
