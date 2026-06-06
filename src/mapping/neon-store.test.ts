/**
 * Test d'acceptation du NeonMappingStore (B8, ADR-0005).
 *
 * Adapter Neon du port MappingStore. On INJECTE les fonctions de requete (pas de
 * drizzle ni de vraie DB ici) : le test verifie le comportement de cache et
 * d'invalidation, pas le SQL. Le cache par guild evite un round-trip Postgres dans
 * le chemin chaud (guildMemberUpdate) ; il est invalide a chaque ecriture.
 */
import { describe, expect, it } from 'bun:test';
import { creerNeonMappingStore, type MappingQueries } from './neon-store';

interface Compteurs {
  selectByGuild: number;
  upsert: number;
  deleteOne: number;
}

/** Fake en memoire des requetes Neon, avec compteurs d'appels (observe le cache). */
function fakeQueries(initial: Record<string, Array<{ roleId: string; styleName: string }>> = {}) {
  const data = new Map<string, Array<{ roleId: string; styleName: string }>>(
    Object.entries(initial).map(([g, lignes]) => [g, [...lignes]]),
  );
  const compteurs: Compteurs = { selectByGuild: 0, upsert: 0, deleteOne: 0 };
  const queries: MappingQueries = {
    selectByGuild: (guildId) => {
      compteurs.selectByGuild += 1;
      return Promise.resolve([...(data.get(guildId) ?? [])]);
    },
    upsert: (guildId, roleId, styleName) => {
      compteurs.upsert += 1;
      const lignes = data.get(guildId) ?? [];
      const sansLeRole = lignes.filter((l) => l.roleId !== roleId);
      sansLeRole.push({ roleId, styleName });
      data.set(guildId, sansLeRole);
      return Promise.resolve();
    },
    deleteOne: (guildId, roleId) => {
      compteurs.deleteOne += 1;
      const lignes = data.get(guildId) ?? [];
      data.set(guildId, lignes.filter((l) => l.roleId !== roleId));
      return Promise.resolve();
    },
  };
  return { queries, compteurs, data };
}

describe('NeonMappingStore', () => {
  it('list renvoie le mapping ordonne (ordre = priorite, ADR-0004)', async () => {
    const { queries } = fakeQueries({
      g1: [
        { roleId: 'r1', styleName: 'gothique' },
        { roleId: 'r2', styleName: 'cursive' },
      ],
    });
    const store = creerNeonMappingStore(queries);
    expect(await store.list('g1')).toEqual({ r1: 'gothique', r2: 'cursive' });
    expect(Object.keys(await store.list('g1'))).toEqual(['r1', 'r2']);
  });

  it('styleForRole renvoie le style mappe, sinon null', async () => {
    const { queries } = fakeQueries({ g1: [{ roleId: 'r1', styleName: 'cursive' }] });
    const store = creerNeonMappingStore(queries);
    expect(await store.styleForRole('g1', 'r1')).toBe('cursive');
    expect(await store.styleForRole('g1', 'absent')).toBeNull();
    expect(await store.styleForRole('autre-guild', 'r1')).toBeNull();
  });

  it('met en CACHE par guild : un 2e list ne refrappe PAS la DB', async () => {
    const { queries, compteurs } = fakeQueries({ g1: [{ roleId: 'r1', styleName: 'cursive' }] });
    const store = creerNeonMappingStore(queries);
    await store.list('g1');
    await store.list('g1');
    await store.styleForRole('g1', 'r1');
    expect(compteurs.selectByGuild).toBe(1); // une seule lecture DB pour g1
  });

  it('cache PAR guild : g2 declenche sa propre lecture', async () => {
    const { queries, compteurs } = fakeQueries({
      g1: [{ roleId: 'r1', styleName: 'cursive' }],
      g2: [{ roleId: 'r9', styleName: 'gras' }],
    });
    const store = creerNeonMappingStore(queries);
    await store.list('g1');
    await store.list('g2');
    expect(compteurs.selectByGuild).toBe(2);
  });

  it('add INVALIDE le cache de la guild : le list suivant relit la DB', async () => {
    const { queries, compteurs } = fakeQueries({ g1: [{ roleId: 'r1', styleName: 'cursive' }] });
    const store = creerNeonMappingStore(queries);
    await store.list('g1'); // selectByGuild = 1, cache chaud
    await store.add('g1', 'r2', 'gothique'); // upsert + invalidation
    const apres = await store.list('g1'); // relit (cache invalide)
    expect(compteurs.upsert).toBe(1);
    expect(compteurs.selectByGuild).toBe(2);
    expect(apres).toEqual({ r1: 'cursive', r2: 'gothique' });
  });

  it('remove INVALIDE le cache de la guild', async () => {
    const { queries, compteurs } = fakeQueries({
      g1: [
        { roleId: 'r1', styleName: 'cursive' },
        { roleId: 'r2', styleName: 'gothique' },
      ],
    });
    const store = creerNeonMappingStore(queries);
    await store.list('g1');
    await store.remove('g1', 'r1');
    const apres = await store.list('g1');
    expect(compteurs.deleteOne).toBe(1);
    expect(compteurs.selectByGuild).toBe(2);
    expect(apres).toEqual({ r2: 'gothique' });
  });

  it("l'invalidation est CIBLEE : add sur g1 ne vide pas le cache de g2", async () => {
    const { queries, compteurs } = fakeQueries({
      g1: [{ roleId: 'r1', styleName: 'cursive' }],
      g2: [{ roleId: 'r9', styleName: 'gras' }],
    });
    const store = creerNeonMappingStore(queries);
    await store.list('g1');
    await store.list('g2'); // selectByGuild = 2
    await store.add('g1', 'rX', 'double'); // invalide g1 seulement
    await store.list('g2'); // doit venir du cache (pas de relecture)
    expect(compteurs.selectByGuild).toBe(2);
  });

  it('guild sans mapping -> objet vide, et le vide est mis en cache', async () => {
    const { queries, compteurs } = fakeQueries({});
    const store = creerNeonMappingStore(queries);
    expect(await store.list('vide')).toEqual({});
    await store.list('vide');
    expect(compteurs.selectByGuild).toBe(1);
  });
});
