/**
 * Adapter MEMOIRE du port OriginalNickStore (issue #25) — mode DEV, sans DATABASE_URL.
 *
 * Comme l'opt-out memoire, le pseudo d'origine est une donnee d'execution : en dev on le
 * tient EN MEMOIRE (ephemere, perdu au redemarrage). Le round-trip reste fonctionnel hors
 * Neon dans une meme session ; la persistance entre runs n'existe qu'en mode Neon.
 */
import type { OriginalNickStore } from "./store";

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
    rememberWithDeadline(guildId, memberId, nick, expiresAt) {
      const k = cle(guildId, memberId);
      const existante = lignes.get(k);
      if (existante) {
        // Rafraichit l'echeance SANS ecraser l'original (garde le vrai pseudo memorise).
        existante.expiresAt = expiresAt;
        return Promise.resolve(false);
      }
      lignes.set(k, { guildId, memberId, nick, expiresAt });
      return Promise.resolve(true);
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
    listPendingByGuild(guildId, maintenant) {
      const pending = [...lignes.values()]
        .filter((l) => l.guildId === guildId && l.expiresAt !== undefined && l.expiresAt > maintenant)
        .map((l) => ({ memberId: l.memberId, nick: l.nick, expiresAt: l.expiresAt! }));
      return Promise.resolve(pending);
    },
    getPending(guildId, memberId) {
      const l = lignes.get(cle(guildId, memberId));
      if (!l || l.expiresAt === undefined) return Promise.resolve(null);
      return Promise.resolve({ nick: l.nick, expiresAt: l.expiresAt });
    },
  };
}
