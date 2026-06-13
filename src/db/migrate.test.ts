/**
 * Tests du migrate-on-boot (B8, ADR-0005).
 *
 * Pas de DB reelle : on INJECTE le migrator (meme principe de DI que les stores Neon).
 * Deux branches : DATABASE_URL present => migrate appele avec le dossier `drizzle` ;
 * absent => saute, aucun migrator appele, aucune connexion ouverte.
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { runMigrations, MIGRATIONS_FOLDER, type Migrator } from './migrate';
import { closeDb } from './client';

afterEach(async () => {
  await closeDb();
});

describe('migrate-on-boot', () => {
  it('applique les migrations depuis le dossier `drizzle` quand DATABASE_URL est present', async () => {
    const calls: Array<{ migrationsFolder: string }> = [];
    const fakeMigrate: Migrator = (_db, options) => {
      calls.push(options);
      return Promise.resolve();
    };

    await runMigrations('postgres://user:pass@localhost:5432/db', fakeMigrate);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ migrationsFolder: MIGRATIONS_FOLDER });
  });

  it('saute les migrations quand DATABASE_URL est absent', async () => {
    let appele = false;
    const fakeMigrate: Migrator = () => {
      appele = true;
      return Promise.resolve();
    };

    await runMigrations(undefined, fakeMigrate);

    expect(appele).toBe(false);
  });
});
