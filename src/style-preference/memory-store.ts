/**
 * Adapter MEMOIRE du port StylePreferenceStore — mode DEV, sans DATABASE_URL.
 *
 * Comme l'opt-out, la signature de style est une donnee d'execution (pas de fichier source) :
 * en dev on la tient EN MEMOIRE (ephemere, perdue au redemarrage). `/renamioos style|reset`
 * reste fonctionnel hors Neon, sans persistance entre deux runs (acceptable en dev).
 */
import type { StyleName } from "../domain/styles";
import type { StylePreferenceStore } from "./store";

export function creerMemoryStylePreferenceStore(): StylePreferenceStore {
  const parGuild = new Map<string, Map<string, StyleName>>();

  return {
    get(guildId, memberId) {
      return Promise.resolve(parGuild.get(guildId)?.get(memberId) ?? null);
    },
    set(guildId, memberId, style) {
      const membres = parGuild.get(guildId) ?? new Map<string, StyleName>();
      membres.set(memberId, style);
      parGuild.set(guildId, membres);
      return Promise.resolve();
    },
    clear(guildId, memberId) {
      parGuild.get(guildId)?.delete(memberId);
      return Promise.resolve();
    },
  };
}
