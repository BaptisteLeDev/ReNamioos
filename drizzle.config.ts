/**
 * Config drizzle-kit — generation + application des migrations (B8, ADR-0005).
 *
 * Le schema (src/db/schema.ts) reflete les 6 tables deja provisionnees sur Neon
 * (projet square-frost-15330405). `db:generate` produit le SQL dans `drizzle/`,
 * `db:migrate` l'applique. Au runtime, src/db/migrate.ts joue le meme dossier au
 * boot (auto-migrate). Bun charge le `.env` courant : DATABASE_URL en provient.
 */
import { defineConfig } from 'drizzle-kit';

const url = process.env['DATABASE_URL'];
if (!url) {
  throw new Error('DATABASE_URL est requis pour drizzle-kit');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: false,
});
