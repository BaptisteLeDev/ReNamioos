/**
 * Adapter Neon du port OptOutStore (issue #27).
 *
 * Persiste le consentement membre dans la table `auto_rename_optouts` (Neon), derriere
 * un CACHE en memoire PAR GUILD : l'ensemble des memberId opt-out de la guild. Le cache
 * evite un round-trip Postgres dans le chemin chaud (guildMemberUpdate, appele a chaque
 * changement de role d'un membre) ; il est INVALIDE de facon ciblee a chaque ecriture
 * (optOut / optIn) sur la guild concernee.
 *
 * Minimisation D8 : une ligne n'existe QUE pour un membre opt-out (le defaut est le
 * consentement = absence de ligne). `optIn` SUPPRIME la ligne. La table reste minuscule.
 *
 * Les fonctions de requete sont INJECTEES (`OptOutQueries`) : le SQL/drizzle vit dans
 * `creerNeonOptOutQueries` (neon-queries.ts), ce module ne connait que des promesses
 * (cache et invalidation testables sans vraie DB, cf. neon-store.test.ts).
 */
import type { OptOutStore } from "./store";

/** Frontiere d'I/O injectable : tout l'acces Postgres passe par ces trois fonctions. */
export interface OptOutQueries {
  /** memberId opt-out de la guild. */
  selectByGuild(guildId: string): Promise<string[]>;
  /** Insere le refus (ON CONFLICT DO NOTHING : idempotent sur la PK). */
  insert(guildId: string, memberId: string): Promise<void>;
  /** Supprime la ligne (guild, membre) si elle existe. */
  deleteOne(guildId: string, memberId: string): Promise<void>;
}

export function creerNeonOptOutStore(queries: OptOutQueries): OptOutStore {
  // Cache PAR guild de l'ensemble des memberId opt-out. Absence de cle = jamais charge.
  const cache = new Map<string, Set<string>>();

  async function optOutsDeGuild(guildId: string): Promise<Set<string>> {
    const enCache = cache.get(guildId);
    if (enCache) return enCache;
    const ids = new Set(await queries.selectByGuild(guildId));
    cache.set(guildId, ids);
    return ids;
  }

  return {
    async isOptOut(guildId, memberId) {
      return (await optOutsDeGuild(guildId)).has(memberId);
    },

    async optOut(guildId, memberId) {
      await queries.insert(guildId, memberId);
      cache.delete(guildId); // invalidation ciblee
    },

    async optIn(guildId, memberId) {
      await queries.deleteOne(guildId, memberId);
      cache.delete(guildId); // invalidation ciblee
    },
  };
}
