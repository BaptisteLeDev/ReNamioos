/**
 * Test d'acceptation du NeonOptOutStore (issue #27).
 *
 * Adapter Neon du port OptOutStore. On INJECTE les fonctions de requete (pas de drizzle
 * ni de vraie DB ici) : le test verifie le comportement de cache par guild et son
 * invalidation a chaque ecriture. Le cache evite un round-trip Postgres dans le chemin
 * chaud (guildMemberUpdate, appele a chaque changement de role d'un membre).
 */
import { describe, expect, it } from 'bun:test';
import { creerNeonOptOutStore, type OptOutQueries } from './neon-store';

interface Compteurs {
  selectByGuild: number;
  insert: number;
  deleteOne: number;
}

/** Fake en memoire des requetes Neon, avec compteurs d'appels (observe le cache). */
function fakeQueries(initial: Record<string, string[]> = {}) {
  const data = new Map<string, Set<string>>(
    Object.entries(initial).map(([g, ids]) => [g, new Set(ids)]),
  );
  const compteurs: Compteurs = { selectByGuild: 0, insert: 0, deleteOne: 0 };
  const queries: OptOutQueries = {
    selectByGuild: (guildId) => {
      compteurs.selectByGuild += 1;
      return Promise.resolve([...(data.get(guildId) ?? [])]);
    },
    insert: (guildId, memberId) => {
      compteurs.insert += 1;
      const ids = data.get(guildId) ?? new Set<string>();
      ids.add(memberId);
      data.set(guildId, ids);
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

describe('NeonOptOutStore', () => {
  it('isOptOut: true si le membre a une ligne, false sinon', async () => {
    const { queries } = fakeQueries({ g1: ['m1'] });
    const store = creerNeonOptOutStore(queries);
    expect(await store.isOptOut('g1', 'm1')).toBe(true);
    expect(await store.isOptOut('g1', 'absent')).toBe(false);
    expect(await store.isOptOut('autre-guild', 'm1')).toBe(false);
  });

  it('met en CACHE par guild : un 2e isOptOut ne refrappe PAS la DB', async () => {
    const { queries, compteurs } = fakeQueries({ g1: ['m1'] });
    const store = creerNeonOptOutStore(queries);
    await store.isOptOut('g1', 'm1');
    await store.isOptOut('g1', 'm2');
    expect(compteurs.selectByGuild).toBe(1);
  });

  it('optOut persiste et INVALIDE le cache de la guild', async () => {
    const { queries, compteurs } = fakeQueries({});
    const store = creerNeonOptOutStore(queries);
    expect(await store.isOptOut('g1', 'm1')).toBe(false); // selectByGuild = 1
    await store.optOut('g1', 'm1'); // insert + invalidation
    expect(await store.isOptOut('g1', 'm1')).toBe(true); // relit (cache invalide)
    expect(compteurs.insert).toBe(1);
    expect(compteurs.selectByGuild).toBe(2);
  });

  it('optIn supprime la ligne et INVALIDE le cache (minimisation D8)', async () => {
    const { queries, compteurs } = fakeQueries({ g1: ['m1'] });
    const store = creerNeonOptOutStore(queries);
    expect(await store.isOptOut('g1', 'm1')).toBe(true);
    await store.optIn('g1', 'm1');
    expect(await store.isOptOut('g1', 'm1')).toBe(false);
    expect(compteurs.deleteOne).toBe(1);
    expect(compteurs.selectByGuild).toBe(2);
  });

  it("l'invalidation est CIBLEE : optOut sur g1 ne vide pas le cache de g2", async () => {
    const { queries, compteurs } = fakeQueries({ g1: ['m1'], g2: ['m9'] });
    const store = creerNeonOptOutStore(queries);
    await store.isOptOut('g1', 'm1');
    await store.isOptOut('g2', 'm9'); // selectByGuild = 2
    await store.optOut('g1', 'mX'); // invalide g1 seulement
    await store.isOptOut('g2', 'm9'); // doit venir du cache
    expect(compteurs.selectByGuild).toBe(2);
  });
});
