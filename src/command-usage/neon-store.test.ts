/**
 * Test d'acceptation du NeonCommandUsageStore (issue #27).
 *
 * Adapter Neon du port CommandUsageStore. On INJECTE les fonctions de requete (pas de
 * drizzle ni de vraie DB). Verifie que :
 *  - `load` hydrate le cache memoire depuis Postgres (un seul round-trip, au boot) ;
 *  - `record` incremente Postgres (upsert) ET le cache memoire ;
 *  - `commandsDaily` lit le CACHE (synchrone, pas de round-trip) — invariant /stats.
 */
import { describe, expect, it } from 'bun:test';
import { creerNeonCommandUsageStore, type CommandUsageQueries } from './neon-store';
import type { CompteJournalier } from '../domain/command-usage';

function fakeQueries(seed: CompteJournalier[] = []) {
  const incrementsAppeles: string[] = [];
  const queries: CommandUsageQueries = {
    selectDerniers: () => Promise.resolve(seed),
    incrementJour: (day) => {
      incrementsAppeles.push(day);
      return Promise.resolve();
    },
  };
  return { queries, incrementsAppeles };
}

describe('NeonCommandUsageStore', () => {
  it('load hydrate le cache : commandsDaily reflete la DB sans round-trip', async () => {
    const { queries } = fakeQueries([
      { day: '2026-06-11', count: 4 },
      { day: '2026-06-12', count: 1 },
    ]);
    const store = creerNeonCommandUsageStore(queries, {
      now: () => new Date('2026-06-12T10:00:00Z'),
    });
    await store.load();
    expect(store.commandsDaily()).toEqual([
      { day: '2026-06-11', count: 4 },
      { day: '2026-06-12', count: 1 },
    ]);
  });

  it('record upsert en DB ET incremente le cache memoire (lecture synchrone)', async () => {
    const { queries, incrementsAppeles } = fakeQueries([{ day: '2026-06-12', count: 1 }]);
    const store = creerNeonCommandUsageStore(queries, {
      now: () => new Date('2026-06-12T10:00:00Z'),
    });
    await store.load();
    await store.record();
    expect(incrementsAppeles).toEqual(['2026-06-12']);
    expect(store.commandsDaily()).toEqual([{ day: '2026-06-12', count: 2 }]);
  });

  it('record sans load prealable demarre le cache a partir de zero', async () => {
    const { queries } = fakeQueries();
    const store = creerNeonCommandUsageStore(queries, {
      now: () => new Date('2026-06-12T10:00:00Z'),
    });
    await store.record();
    expect(store.commandsDaily()).toEqual([{ day: '2026-06-12', count: 1 }]);
  });
});
