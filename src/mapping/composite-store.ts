/**
 * Composite MappingStore : Neon + FALLBACK LECTURE fichier (B8, ADR-0005).
 *
 * Store de TRANSITION du mode Neon. Provenance principale = Neon (par serveur,
 * ecriture depuis /auto-rename). Tant qu'une guild n'a AUCUN mapping en base, on
 * lit `auto-rename.json` en fallback, le temps que les admins recreent leur config
 * via la commande. Des qu'un mapping Neon existe pour la guild, le fichier est
 * IGNORE pour cette guild (Neon fait foi). L'ECRITURE va toujours en Neon.
 *
 * Documente comme TRANSITOIRE : a retirer une release plus tard (issue #19), une
 * fois la bascule terminee. A ce moment, le mode Neon utilisera directement le
 * NeonMappingStore et ce composite disparaitra.
 */
import type { MappingRoleStyle } from "../domain/auto-rename";
import type { MappingStore } from "./store";

export function creerCompositeMappingStore(
  neon: MappingStore,
  fichier: MappingStore,
): MappingStore {
  async function mappingDeGuild(guildId: string): Promise<MappingRoleStyle> {
    const depuisNeon = await neon.list(guildId);
    // Fallback UNIQUEMENT si la guild n'a rien en base (transition).
    if (Object.keys(depuisNeon).length > 0) return depuisNeon;
    return fichier.list(guildId);
  }

  return {
    async styleForRole(guildId, roleId) {
      const mapping = await mappingDeGuild(guildId);
      return mapping[roleId] ?? null;
    },
    // Ecriture : toujours Neon (la config par serveur ne vit qu'en base).
    add: (guildId, roleId, styleName) => neon.add(guildId, roleId, styleName),
    remove: (guildId, roleId) => neon.remove(guildId, roleId),
    list: (guildId) => mappingDeGuild(guildId),
  };
}
