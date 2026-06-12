/**
 * Tests de l'adapter MEMOIRE du port OriginalNickStore (issue #25) — mode DEV.
 *
 * Verifie : memorisation idempotente (ne pas ecraser l'original), lecture, oubli, et
 * isolation par (guild, membre).
 */
import { describe, expect, it } from 'bun:test';
import { creerMemoryOriginalNickStore } from './memory-store';

describe('MemoryOriginalNickStore', () => {
  it('get renvoie null tant que rien n est memorise', async () => {
    const store = creerMemoryOriginalNickStore();
    expect(await store.get('g1', 'm1')).toBeNull();
  });

  it('rememberIfAbsent memorise puis get le renvoie', async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent('g1', 'm1', 'Bob');
    expect(await store.get('g1', 'm1')).toBe('Bob');
  });

  it('rememberIfAbsent n ECRASE PAS un original deja memorise (idempotence #25)', async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent('g1', 'm1', 'Bob');
    await store.rememberIfAbsent('g1', 'm1', '𝓑𝓸𝓫'); // re-stylisation : on garde l original
    expect(await store.get('g1', 'm1')).toBe('Bob');
  });

  it('forget oublie le pseudo (get -> null ensuite)', async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent('g1', 'm1', 'Bob');
    await store.forget('g1', 'm1');
    expect(await store.get('g1', 'm1')).toBeNull();
  });

  it('isole par (guild, membre)', async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent('g1', 'm1', 'Bob');
    expect(await store.get('g1', 'autre')).toBeNull();
    expect(await store.get('autre', 'm1')).toBeNull();
  });
});
