/**
 * Adapter MEMOIRE du port OptOutStore (issue #27) — mode DEV, sans DATABASE_URL.
 *
 * Contrairement au mapping (config admin versionnee dans un fichier), le consentement
 * membre n'a pas de fichier source : c'est une donnee d'execution. En dev, on le tient
 * EN MEMOIRE (ephemere, perdu au redemarrage). La commande `/renamioos opt-out|opt-in`
 * reste donc fonctionnelle hors Neon, sans persistance entre deux runs (acceptable en
 * dev ; la persistance par serveur n'existe qu'en mode Neon, comme le mapping).
 */
import type { OptOutStore } from "./store";

export function creerMemoryOptOutStore(): OptOutStore {
  const parGuild = new Map<string, Set<string>>();

  return {
    isOptOut(guildId, memberId) {
      return Promise.resolve(parGuild.get(guildId)?.has(memberId) ?? false);
    },
    optOut(guildId, memberId) {
      const ids = parGuild.get(guildId) ?? new Set<string>();
      ids.add(memberId);
      parGuild.set(guildId, ids);
      return Promise.resolve();
    },
    optIn(guildId, memberId) {
      parGuild.get(guildId)?.delete(memberId);
      return Promise.resolve();
    },
  };
}
