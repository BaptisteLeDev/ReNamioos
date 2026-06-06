/**
 * Client Postgres (Neon) + instance drizzle-orm — B8, cf. decisions/0005.
 *
 * Init PARESSEUSE : le Pool n'est cree qu'au premier appel a `getDb()`, depuis
 * `config.database.url`. Raison : en mode FICHIER (dev, sans DATABASE_URL) le bot
 * ne doit JAMAIS ouvrir de connexion Postgres ni meme construire le Pool. Importer
 * ce module reste donc sans effet de bord (pattern Moodioos adapte au mode optionnel).
 *
 * Petit pool : le bot est un unique processus long-vivant.
 */
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let db: Db | null = null;

/**
 * Renvoie l'instance drizzle, en la creant au premier appel a partir de l'URL
 * fournie. Idempotent : les appels suivants ignorent l'URL et renvoient le cache.
 * @throws Error si appele sans URL alors qu'aucun client n'a encore ete initialise.
 */
export function getDb(connectionString: string | undefined): Db {
  if (db) return db;
  if (!connectionString) {
    throw new Error(
      'getDb() appele sans DATABASE_URL : le mode Neon exige une URL de connexion. ' +
        'En mode fichier (dev), ne pas appeler getDb().',
    );
  }
  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', (err) => console.error('[db] pg pool error', err));
  db = drizzle(pool, { schema });
  return db;
}

/** Ferme le pool (arret propre). No-op si jamais initialise (mode fichier). */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export { schema };
