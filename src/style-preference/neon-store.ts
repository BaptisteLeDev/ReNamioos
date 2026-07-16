/**
 * Adapter NEON du port StylePreferenceStore. Persiste la signature de style par membre dans
 * la table `auto_rename_style_preferences`, derriere un CACHE en memoire PAR GUILD (Map
 * memberId -> StyleName). Le cache evite un round-trip Postgres dans le chemin chaud
 * (guildMemberUpdate) ; il est INVALIDE de facon ciblee a chaque ecriture (set / clear).
 *
 * Minimisation D8 : une ligne n'existe QUE si le membre a pose une signature ; `clear`
 * SUPPRIME la ligne. En lecture, le style est RE-VALIDE (parseStyleName) : un style disparu
 * du catalogue = donnee corrompue -> traite comme absent, avec un warn (jamais de silence).
 *
 * Les requetes sont INJECTEES (`StylePreferenceQueries`) : le SQL/drizzle vit dans
 * neon-queries.ts ; ce module ne connait que des promesses (testable sans DB).
 */
import { parseStyleName, type StyleName } from "../domain/styles";
import type { StylePreferenceStore } from "./store";

/** Frontiere d'I/O injectable : tout l'acces Postgres passe par ces trois fonctions. */
export interface StylePreferenceQueries {
  /** Signatures (memberId + styleName brut) de la guild. */
  selectByGuild(guildId: string): Promise<Array<{ memberId: string; styleName: string }>>;
  /** Upsert de la signature (ON CONFLICT DO UPDATE sur la PK). */
  upsert(guildId: string, memberId: string, styleName: string): Promise<void>;
  /** Supprime la ligne (guild, membre) si elle existe. */
  deleteOne(guildId: string, memberId: string): Promise<void>;
}

export function creerNeonStylePreferenceStore(
  queries: StylePreferenceQueries,
): StylePreferenceStore {
  const cache = new Map<string, Map<string, StyleName>>();

  async function signaturesDeGuild(guildId: string): Promise<Map<string, StyleName>> {
    const enCache = cache.get(guildId);
    if (enCache) return enCache;
    const lignes = await queries.selectByGuild(guildId);
    const map = new Map<string, StyleName>();
    for (const { memberId, styleName } of lignes) {
      const style = parseStyleName(styleName);
      if (style === null) {
        console.warn(
          `Signature de style invalide en base (guilde ${guildId}, membre ${memberId}, ` +
            `valeur ${JSON.stringify(styleName)}) : ignoree, traitee comme absente.`,
        );
        continue;
      }
      map.set(memberId, style);
    }
    cache.set(guildId, map);
    return map;
  }

  return {
    async get(guildId, memberId) {
      return (await signaturesDeGuild(guildId)).get(memberId) ?? null;
    },
    async set(guildId, memberId, style) {
      await queries.upsert(guildId, memberId, style);
      cache.delete(guildId); // invalidation ciblee
    },
    async clear(guildId, memberId) {
      await queries.deleteOne(guildId, memberId);
      cache.delete(guildId); // invalidation ciblee
    },
  };
}
