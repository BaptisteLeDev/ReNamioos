/**
 * Test d'acceptation du NeonOriginalNickStore (issue #25).
 *
 * Adapter Neon du port OriginalNickStore. On INJECTE les fonctions de requete (pas de
 * drizzle ni de vraie DB) : le test verifie le cache par guild (le chemin chaud
 * guildMemberUpdate ne refrappe pas la base) et son invalidation a chaque ecriture, ainsi
 * que l'idempotence de la memorisation (ne pas ecraser l'original).
 */
import { describe, expect, it } from 'bun:test';
import { creerNeonOriginalNickStore, type OriginalNickQueries } from './neon-store';

interface Compteurs {
  selectByGuild: number;
  upsertIfAbsent: number;
  deleteOne: number;
}

function fakeQueries(initial: Record<string, Record<string, string>> = {}) {
  const data = new Map<string, Map<string, string>>(
    Object.entries(initial).map(([g, m]) => [g, new Map(Object.entries(m))]),
  );
  const compteurs: Compteurs = { selectByGuild: 0, upsertIfAbsent: 0, deleteOne: 0 };
  const queries: OriginalNickQueries = {
    selectByGuild: (guildId) => {
      compteurs.selectByGuild += 1;
      const m = data.get(guildId) ?? new Map();
      return Promise.resolve([...m.entries()].map(([memberId, nick]) => ({ memberId, nick })));
    },
    upsertIfAbsent: (guildId, memberId, nick) => {
      compteurs.upsertIfAbsent += 1;
      const m = data.get(guildId) ?? new Map<string, string>();
      if (!m.has(memberId)) m.set(memberId, nick); // ON CONFLICT DO NOTHING
      data.set(guildId, m);
      return Promise.resolve();
    },
    deleteOne: (guildId, memberId) => {
      compteurs.deleteOne += 1;
      data.get(guildId)?.delete(memberId);
      return Promise.resolve();
    },
  };
  return { queries, compteurs, data };
}

describe('NeonOriginalNickStore', () => {
  it('get renvoie le nick memorise, null sinon', async () => {
    const { queries } = fakeQueries({ g1: { m1: 'Bob' } });
    const store = creerNeonOriginalNickStore(queries);
    expect(await store.get('g1', 'm1')).toBe('Bob');
    expect(await store.get('g1', 'absent')).toBeNull();
  });

  it('met en CACHE par guild : un 2e get ne refrappe PAS la DB', async () => {
    const { queries, compteurs } = fakeQueries({ g1: { m1: 'Bob' } });
    const store = creerNeonOriginalNickStore(queries);
    await store.get('g1', 'm1');
    await store.get('g1', 'm2');
    expect(compteurs.selectByGuild).toBe(1);
  });

  it('rememberIfAbsent persiste et INVALIDE le cache de la guild', async () => {
    const { queries, compteurs } = fakeQueries({});
    const store = creerNeonOriginalNickStore(queries);
    expect(await store.get('g1', 'm1')).toBeNull(); // selectByGuild = 1
    await store.rememberIfAbsent('g1', 'm1', 'Bob');
    expect(await store.get('g1', 'm1')).toBe('Bob'); // relit (cache invalide)
    expect(compteurs.upsertIfAbsent).toBe(1);
    expect(compteurs.selectByGuild).toBe(2);
  });

  it('forget supprime la ligne et INVALIDE le cache (minimisation D8)', async () => {
    const { queries, compteurs } = fakeQueries({ g1: { m1: 'Bob' } });
    const store = creerNeonOriginalNickStore(queries);
    expect(await store.get('g1', 'm1')).toBe('Bob');
    await store.forget('g1', 'm1');
    expect(await store.get('g1', 'm1')).toBeNull();
    expect(compteurs.deleteOne).toBe(1);
    expect(compteurs.selectByGuild).toBe(2);
  });
});
