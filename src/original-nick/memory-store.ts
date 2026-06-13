/**
 * Adapter MEMOIRE du port OriginalNickStore (issue #25) — mode DEV, sans DATABASE_URL.
 *
 * Comme l'opt-out memoire, le pseudo d'origine est une donnee d'execution : en dev on le
 * tient EN MEMOIRE (ephemere, perdu au redemarrage). Le round-trip reste fonctionnel hors
 * Neon dans une meme session ; la persistance entre runs n'existe qu'en mode Neon.
 */
import type { OriginalNickStore } from './store';

interface Ligne {
  guildId: string;
  memberId: string;
  nick: string;
  /** Echeance de revert temporaire (epoch ms, #38). Absente => revert par role uniquement. */
  expiresAt: number | undefined;
}

function cle(guildId: string, memberId: string): string {
  return `${guildId}:${memberId}`;
}

export function creerMemoryOriginalNickStore(): OriginalNickStore {
  const lignes = new Map<string, Ligne>();

  return {
    get(guildId, memberId) {
      return Promise.resolve(lignes.get(cle(guildId, memberId))?.nick ?? null);
    },
    rememberIfAbsent(guildId, memberId, nick, expiresAt) {
      const k = cle(guildId, memberId);
      // Ne pas ecraser l'original NI son echeance (idempotence #25/#38).
      if (!lignes.has(k)) lignes.set(k, { guildId, memberId, nick, expiresAt });
      return Promise.resolve();
    },
    forget(guildId, memberId) {
      lignes.delete(cle(guildId, memberId));
      return Promise.resolve();
    },
    listDue(maintenant) {
      const dues = [...lignes.values()]
        .filter((l) => l.expiresAt !== undefined && l.expiresAt <= maintenant)
        .map((l) => ({ guildId: l.guildId, memberId: l.memberId, nick: l.nick }));
      return Promise.resolve(dues);
    },
  };
}
