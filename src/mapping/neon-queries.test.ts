/**
 * Test cible de creerNeonQueries (B8, ADR-0005) — la TRADUCTION SQL elle-meme.
 *
 * On ne frappe pas Neon (pas de credentials en local, cf. en-tete neon-queries.ts) :
 * on injecte un FAKE du query builder drizzle qui CAPTURE les fragments construits
 * (.values(...), .onConflictDoUpdate({ set })). C'est le seul niveau ou le bug de
 * priorite est observable : le fake en memoire de neon-store.test.ts fait
 * remove-then-push, donc il ne pourrait jamais attraper un bump d'updated_at.
 *
 * Invariant verifie (ADR-0005 decision 4) : reediter le style d'un role DEJA mappe
 * ne doit PAS toucher updated_at (sinon le role passe en derniere position de
 * priorite, « le role mappe en premier l'emporte » serait viole silencieusement).
 */
import { describe, expect, it } from 'bun:test';
import { creerNeonQueries } from './neon-queries';
import type { Db } from '../db/client';

/** Capture les appels du builder drizzle utilises par creerNeonQueries. */
interface CaptureUpsert {
  values?: Record<string, unknown>;
  set?: Record<string, unknown>;
}

/** Fake minimal du builder drizzle : enregistre values + le set du onConflictDoUpdate. */
function fakeDb(): { db: Db; upsert: CaptureUpsert } {
  const upsert: CaptureUpsert = {};
  const db = {
    insert() {
      return {
        values(v: Record<string, unknown>) {
          upsert.values = v;
          return {
            onConflictDoUpdate(arg: { set: Record<string, unknown> }) {
              upsert.set = arg.set;
              return Promise.resolve();
            },
          };
        },
      };
    },
  } as unknown as Db;
  return { db, upsert };
}

describe('creerNeonQueries.upsert', () => {
  it('ecrit le style et la cle dans values', async () => {
    const { db, upsert } = fakeDb();
    await creerNeonQueries(db).upsert('g1', 'r1', 'cursive');
    expect(upsert.values).toEqual({ guildId: 'g1', roleId: 'r1', styleName: 'cursive' });
  });

  it("editer le style d'un role ne change pas sa priorite (updated_at intact sur conflit)", async () => {
    const { db, upsert } = fakeDb();
    await creerNeonQueries(db).upsert('g1', 'r1', 'gothique');
    // Sur conflit on remplace le style, mais on ne touche PAS updated_at : l'ordre
    // d'insertion d'origine (= priorite, ADR-0005 d.4) est preserve.
    expect(upsert.set).toEqual({ styleName: 'gothique' });
    expect(upsert.set).not.toHaveProperty('updatedAt');
  });
});
