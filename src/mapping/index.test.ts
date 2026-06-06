/**
 * Test de la COMPOSITION du MappingStore (B8, ADR-0005).
 *
 * Branche le bon adapter selon la presence de DATABASE_URL :
 *  - absente  => FichierMappingStore seul (mode dev, lecture seule).
 *  - presente => Neon + FALLBACK lecture fichier (CompositeMappingStore).
 *
 * On INJECTE les queries Neon (fake) pour ne PAS ouvrir de connexion Postgres reelle
 * (consigne B8 : aucun acces a la vraie DB en test).
 */
import { describe, expect, it } from 'bun:test';
import { creerMappingStore } from './index';
import type { MappingQueries } from './neon-store';

function fakeQueries(): MappingQueries {
  const data = new Map<string, Array<{ roleId: string; styleName: string }>>();
  return {
    selectByGuild: (g) => Promise.resolve([...(data.get(g) ?? [])]),
    upsert: (g, r, s) => {
      const l = (data.get(g) ?? []).filter((x) => x.roleId !== r);
      l.push({ roleId: r, styleName: s });
      data.set(g, l);
      return Promise.resolve();
    },
    deleteOne: (g, r) => {
      data.set(g, (data.get(g) ?? []).filter((x) => x.roleId !== r));
      return Promise.resolve();
    },
  };
}

describe('creerMappingStore (composition par DATABASE_URL)', () => {
  it('sans DATABASE_URL -> mode fichier en LECTURE SEULE', async () => {
    const store = creerMappingStore({
      databaseUrl: undefined,
      mappingFichier: { rF: 'gothique' },
    });
    expect(await store.list('g')).toEqual({ rF: 'gothique' });
    await expect(store.add('g', 'r1', 'cursive')).rejects.toThrow(/fichier|Neon|DATABASE_URL/i);
  });

  it('avec DATABASE_URL -> mode Neon avec fallback fichier, ECRITURE possible', async () => {
    const store = creerMappingStore({
      databaseUrl: 'postgres://fake',
      mappingFichier: { rF: 'gothique' },
      queries: fakeQueries(),
    });
    // Guild neuve : fallback fichier.
    expect(await store.list('g1')).toEqual({ rF: 'gothique' });
    // Ecriture en Neon -> bascule hors fallback.
    await store.add('g1', 'r1', 'cursive');
    expect(await store.list('g1')).toEqual({ r1: 'cursive' });
  });
});
