/**
 * Adapter Neon du port MappingStore (B8, ADR-0005).
 *
 * Persiste la config auto-rename dans la table `auto_rename_mappings` (Neon),
 * derriere un CACHE en memoire PAR GUILD. Le cache evite un round-trip Postgres
 * dans le chemin chaud (guildMemberUpdate, appele a chaque changement de rOle d'un
 * membre) ; il est INVALIDE de facon ciblee a chaque ecriture (add / remove) sur la
 * guild concernee. Les autres guilds gardent leur cache (invalidation ciblee).
 *
 * Les fonctions de requete sont INJECTEES (`MappingQueries`) : le SQL/drizzle vit
 * dans `creerNeonQueries` (neon-queries.ts), ce module ne connait que des promesses.
 * Cela rend le cache et l'invalidation testables sans vraie DB (cf. neon-store.test.ts).
 */
import type { MappingRoleStyle } from '../domain/auto-rename';
import type { StyleName } from '../domain/styles';
import type { MappingStore } from './store';

/** Frontiere d'I/O injectable : tout l'acces Postgres passe par ces trois fonctions. */
export interface MappingQueries {
  /** Lignes (rOle, style) de la guild, ORDONNEES par anciennete (priorite = ordre d'ajout). */
  selectByGuild(guildId: string): Promise<Array<{ roleId: string; styleName: string }>>;
  /** Upsert sur la PK (guild_id, role_id) : cree ou remplace le style. */
  upsert(guildId: string, roleId: string, styleName: string): Promise<void>;
  /** Supprime la ligne (guild, rOle) si elle existe. */
  deleteOne(guildId: string, roleId: string): Promise<void>;
}

export function creerNeonMappingStore(queries: MappingQueries): MappingStore {
  // Cache PAR guild du mapping ORDONNE. Absence de cle = jamais charge (lazy).
  const cache = new Map<string, MappingRoleStyle>();

  async function mappingDeGuild(guildId: string): Promise<MappingRoleStyle> {
    const enCache = cache.get(guildId);
    if (enCache) return enCache;
    const lignes = await queries.selectByGuild(guildId);
    const mapping: MappingRoleStyle = {};
    for (const { roleId, styleName } of lignes) {
      mapping[roleId] = styleName as StyleName;
    }
    cache.set(guildId, mapping);
    return mapping;
  }

  return {
    async styleForRole(guildId, roleId) {
      const mapping = await mappingDeGuild(guildId);
      return mapping[roleId] ?? null;
    },

    async add(guildId, roleId, styleName) {
      await queries.upsert(guildId, roleId, styleName);
      cache.delete(guildId); // invalidation ciblee
    },

    async remove(guildId, roleId) {
      await queries.deleteOne(guildId, roleId);
      cache.delete(guildId); // invalidation ciblee
    },

    async list(guildId) {
      return { ...(await mappingDeGuild(guildId)) };
    },
  };
}
