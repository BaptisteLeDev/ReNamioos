/**
 * Tests de l'adapter MEMOIRE du journal d'auto-rename (issue #28) — mode DEV.
 *
 * Verifie : ring-buffer par guilde (on ne garde que les N plus recents), isolation
 * par guilde, et le compteur d'echecs du jour (`failuresToday`) avec sa remise a zero
 * au changement de jour (clock injectee pour un test deterministe).
 */
import { describe, expect, it } from 'bun:test';
import { creerMemoryAutoRenameLogStore } from './memory-store';
import type { AutoRenameLogEntry } from '../domain/auto-rename-log';

function entree(p: Partial<AutoRenameLogEntry> = {}): AutoRenameLogEntry {
  return {
    guildId: 'g1',
    memberId: 'm1',
    style: 'cursive',
    outcome: 'succes',
    detail: 'Bob',
    at: new Date('2026-06-12T10:00:00Z'),
    ...p,
  };
}

describe('MemoryAutoRenameLogStore', () => {
  it('recent renvoie les plus recents (recent -> ancien), borne a la limite', async () => {
    const store = creerMemoryAutoRenameLogStore({ capaciteParGuild: 10 });
    await store.record(entree({ detail: 'a', at: new Date('2026-06-12T10:00:00Z') }));
    await store.record(entree({ detail: 'b', at: new Date('2026-06-12T11:00:00Z') }));
    await store.record(entree({ detail: 'c', at: new Date('2026-06-12T12:00:00Z') }));
    const r = await store.recent('g1', 2);
    expect(r.map((e) => e.detail)).toEqual(['c', 'b']);
  });

  it('borne la retention a capaciteParGuild (jette les plus vieux)', async () => {
    const store = creerMemoryAutoRenameLogStore({ capaciteParGuild: 2 });
    await store.record(entree({ detail: 'a', at: new Date('2026-06-12T10:00:00Z') }));
    await store.record(entree({ detail: 'b', at: new Date('2026-06-12T11:00:00Z') }));
    await store.record(entree({ detail: 'c', at: new Date('2026-06-12T12:00:00Z') }));
    const r = await store.recent('g1', 10);
    expect(r.map((e) => e.detail)).toEqual(['c', 'b']); // 'a' jete (capacite 2)
  });

  it('isole par guilde', async () => {
    const store = creerMemoryAutoRenameLogStore({ capaciteParGuild: 10 });
    await store.record(entree({ guildId: 'g1', detail: 'x' }));
    await store.record(entree({ guildId: 'g2', detail: 'y' }));
    expect((await store.recent('g1', 10)).map((e) => e.detail)).toEqual(['x']);
    expect((await store.recent('g2', 10)).map((e) => e.detail)).toEqual(['y']);
  });

  it('failuresToday compte les echecs du jour, toutes guildes confondues', async () => {
    let maintenant = new Date('2026-06-12T10:00:00Z');
    const store = creerMemoryAutoRenameLogStore({
      capaciteParGuild: 10,
      now: () => maintenant,
    });
    await store.record(entree({ guildId: 'g1', outcome: 'echec' }));
    await store.record(entree({ guildId: 'g2', outcome: 'echec' }));
    await store.record(entree({ guildId: 'g1', outcome: 'succes' }));
    expect(store.failuresToday()).toBe(2);
  });

  it('failuresToday est remis a zero au changement de jour', async () => {
    let maintenant = new Date('2026-06-12T10:00:00Z');
    const store = creerMemoryAutoRenameLogStore({
      capaciteParGuild: 10,
      now: () => maintenant,
    });
    await store.record(entree({ outcome: 'echec' }));
    expect(store.failuresToday()).toBe(2 - 1); // 1
    maintenant = new Date('2026-06-13T09:00:00Z'); // lendemain
    await store.record(entree({ outcome: 'echec', at: maintenant }));
    expect(store.failuresToday()).toBe(1); // compteur de la veille oublie
  });
});
