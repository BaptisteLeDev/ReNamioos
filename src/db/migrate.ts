/**
 * Auto-migrate au boot (B8, ADR-0005).
 *
 * Applique les migrations drizzle (dossier `drizzle/`) au demarrage, AVANT de
 * servir l'API (/health, /stats) et de connecter Discord. La table de suivi
 * `drizzle.__drizzle_migrations` recense les migrations deja appliquees : les
 * NO-OP sont ignorees, seules les FUTURES sont jouees. Plus besoin de lancer
 * `bun run db:migrate` a la main apres chaque deploiement.
 *
 * Sans DATABASE_URL (mode fichier / dev / test), la migration est SAUTEE : on
 * n'ouvre aucune connexion Postgres. Echec en mode Neon = FATAL (on relance pour
 * que le bootstrap log + exit non-zero : un schema desynchronise est non recuperable).
 *
 * Provenance du chemin : le dossier `drizzle/` vit a la racine du repo (dev) et a
 * `/app/drizzle` dans l'image runtime — soit `process.cwd()` dans les deux cas
 * (CMD docker depuis `/app`, bun lance depuis la racine). Convention drizzle-kit.
 */
import { resolve } from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, type Db } from './client';

export const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle');

/** Applique le dossier de migrations a la base. Injectable pour les tests (pas de vraie DB). */
export type Migrator = (db: Db, options: { migrationsFolder: string }) => Promise<void>;

/**
 * Applique les migrations en attente si DATABASE_URL est configure ; sinon saute.
 * @param connectionString URL Postgres (mode Neon) ou undefined (mode fichier).
 * @param run migrator injectable (defaut : drizzle-orm migrate).
 */
export async function runMigrations(
  connectionString: string | undefined,
  run: Migrator = migrate,
): Promise<void> {
  if (!connectionString) {
    console.log('[migrate] DATABASE_URL absent, migrations sautees (mode fichier)');
    return;
  }
  const start = Date.now();
  console.log(`[migrate] application des migrations depuis ${MIGRATIONS_FOLDER}`);
  await run(getDb(connectionString), { migrationsFolder: MIGRATIONS_FOLDER });
  console.log(`[migrate] migrations a jour (${Date.now() - start} ms)`);
}
