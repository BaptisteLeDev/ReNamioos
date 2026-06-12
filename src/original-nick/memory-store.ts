/**
 * Adapter MEMOIRE du port OriginalNickStore (issue #25) — mode DEV, sans DATABASE_URL.
 *
 * Comme l'opt-out memoire, le pseudo d'origine est une donnee d'execution : en dev on le
 * tient EN MEMOIRE (ephemere, perdu au redemarrage). Le round-trip reste fonctionnel hors
 * Neon dans une meme session ; la persistance entre runs n'existe qu'en mode Neon.
 */
import type { OriginalNickStore } from './store';

function cle(guildId: string, memberId: string): string {
  return `${guildId}:${memberId}`;
}

export function creerMemoryOriginalNickStore(): OriginalNickStore {
  const nicks = new Map<string, string>();

  return {
    get(guildId, memberId) {
      return Promise.resolve(nicks.get(cle(guildId, memberId)) ?? null);
    },
    rememberIfAbsent(guildId, memberId, nick) {
      const k = cle(guildId, memberId);
      if (!nicks.has(k)) nicks.set(k, nick); // ne pas ecraser l'original (idempotence #25)
      return Promise.resolve();
    },
    forget(guildId, memberId) {
      nicks.delete(cle(guildId, memberId));
      return Promise.resolve();
    },
  };
}
