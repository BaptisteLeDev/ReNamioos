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
  /** Supprime la ligne (guild, membre) si elle existe. */
  deleteOne(guildId: string, memberId: string): Promise<void>;
  /**
   * Lignes echues (`expires_at <= maintenant`) TOUTES guildes confondues (#38). Lecture
   * directe en DB (le cache par guild ne couvre pas une requete cross-guild par echeance).
   */
  selectDue(
    maintenant: number,
  ): Promise<Array<{ guildId: string; memberId: string; nick: string }>>;
}

export function creerNeonOriginalNickStore(queries: OriginalNickQueries): OriginalNickStore {
  // Cache PAR guild : memberId -> pseudo d'origine. Absence de cle = jamais charge.
  const cache = new Map<string, Map<string, string>>();

  async function nicksDeGuild(guildId: string): Promise<Map<string, string>> {
    const enCache = cache.get(guildId);
    if (enCache) return enCache;
    const lignes = await queries.selectByGuild(guildId);
    const m = new Map(lignes.map((l) => [l.memberId, l.nick]));
    cache.set(guildId, m);
    return m;
  }

  return {
    async get(guildId, memberId) {
      return (await nicksDeGuild(guildId)).get(memberId) ?? null;
    },

    async rememberIfAbsent(guildId, memberId, nick, expiresAt) {
      await queries.upsertIfAbsent(guildId, memberId, nick, expiresAt);
      cache.delete(guildId); // invalidation ciblee
    },

    async forget(guildId, memberId) {
      await queries.deleteOne(guildId, memberId);
      cache.delete(guildId); // invalidation ciblee
    },

    listDue(maintenant) {
      // Lecture directe : le cache par guild (memberId -> nick) ne couvre pas une requete
      // cross-guild par echeance. Le job de balayage est peu frequent (pas le chemin chaud).
      return queries.selectDue(maintenant);
    },
  };
}
