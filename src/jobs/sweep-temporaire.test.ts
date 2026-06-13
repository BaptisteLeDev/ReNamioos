/**
 * Test du job de balayage des renommages temporaires echus (issue #38).
 *
 * Le job LIT les lignes echues via le store (provenance unique du pseudo d'origine #25/#38),
 * demande la RESTAURATION de chacune via un port `restaurer` injecte (l'adapter Discord reel
 * resout le membre et repose le pseudo), puis OUBLIE la ligne en cas de succes (minimisation
 * D8). La DECISION « echue ? » vit dans le domaine pur (`estEchu`/`listDue`) ; ce job n'est
 * qu'un orchestrateur testable sans Discord.
 */
import { describe, expect, it } from 'bun:test';
import { balayerEcheances } from './sweep-temporaire';
import { creerMemoryOriginalNickStore } from '../original-nick/memory-store';

describe('balayerEcheances (#38)', () => {
  it('restaure puis oublie chaque ligne echue', async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent('g1', 'm1', 'Bob', 1000);
    await store.rememberIfAbsent('g1', 'm2', 'Zoe', 5000); // pas encore echue

    const restaures: Array<{ guildId: string; memberId: string; nick: string }> = [];
    const restaurer = (e: { guildId: string; memberId: string; nick: string }) => {
      restaures.push(e);
      return Promise.resolve({ ok: true as const });
    };

    await balayerEcheances({ store, restaurer, maintenant: () => 2000 });

    expect(restaures).toEqual([{ guildId: 'g1', memberId: 'm1', nick: 'Bob' }]);
    expect(await store.get('g1', 'm1')).toBeNull(); // oubliee (restauree)
    expect(await store.get('g1', 'm2')).toBe('Zoe'); // intacte (pas echue)
  });

  it('CONSERVE la ligne si la restauration echoue (retentee au prochain passage)', async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent('g1', 'm1', 'Bob', 1000);

    const restaurer = () => Promise.resolve({ ok: false as const, message: 'Forbidden' });
    await balayerEcheances({ store, restaurer, maintenant: () => 2000 });

    expect(await store.get('g1', 'm1')).toBe('Bob'); // conservee pour retenter
  });

  it('ne fait rien quand aucune ligne n est echue', async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent('g1', 'm1', 'Bob', 9999);
    let appels = 0;
    const restaurer = () => {
      appels += 1;
      return Promise.resolve({ ok: true as const });
    };
    await balayerEcheances({ store, restaurer, maintenant: () => 1000 });
    expect(appels).toBe(0);
  });

  it('une erreur sur une ligne n empeche pas le traitement des suivantes', async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent('g1', 'm1', 'Bob', 1000);
    await store.rememberIfAbsent('g2', 'm2', 'Zoe', 1000);

    const traites: string[] = [];
    const restaurer = (e: { memberId: string }) => {
      traites.push(e.memberId);
      if (e.memberId === 'm1') return Promise.reject(new Error('boom'));
      return Promise.resolve({ ok: true as const });
    };

    await balayerEcheances({ store, restaurer, maintenant: () => 2000 });

    expect(traites).toContain('m2'); // la 2e ligne est bien traitee malgre l echec de la 1re
    expect(await store.get('g2', 'm2')).toBeNull(); // m2 restauree et oubliee
    expect(await store.get('g1', 'm1')).toBe('Bob'); // m1 conservee (erreur)
  });
});
