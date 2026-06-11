/**
 * Configuration centralisee, validee par zod.
 *
 * Bun charge automatiquement le `.env` du repertoire courant : pas besoin de
 * `dotenv`. On valide `process.env` contre un schema typé. Toute la provenance
 * de la config passe par ce module (mandat ARCHITECTURE.md : un seul endroit).
 */
import { z } from 'zod';

const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN est requis'),
  DISCORD_APPLICATION_ID: z.string().min(1, 'DISCORD_APPLICATION_ID est requis'),
  DISCORD_GUILD_ID: z.string().optional(),

  // API HTTP (Fastify) — port distinct du monitoring (8099/3001) par defaut.
  PORT: z.coerce.number().int().positive().default(8199),
  HOST: z.string().default('0.0.0.0'),

  // Durcissement API (findings #22/#23). OPTIONNELS pour rester retro-compatible
  // en dev : absents => /stats ouvert, CORS desactive, rate limit aux defauts.
  // STATS_TOKEN : token Bearer protegeant GET /stats (CWE-306). En prod, fourni a
  // bdf-monitor pour scraper /stats. CORS_ORIGINS : liste d'origines separees par
  // des virgules (CWE-306). RATE_LIMIT_* : quota par IP (CWE-770).
  STATS_TOKEN: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // Auto-rename (B6, ADR-0004) : chemin du mapping roleId -> styleName, charge et
  // valide au boot. Defaut = config versionnee a la racine du repo. Depuis B8
  // (ADR-0005), ce fichier ne sert plus qu'au mode DEV (sans DATABASE_URL) et au
  // FALLBACK lecture pendant la transition vers Neon.
  AUTO_RENAME_CONFIG_PATH: z.string().default('auto-rename.json'),

  // Persistance Neon (B8, ADR-0005) — OPTIONNELLE. Absente => mode FICHIER (dev) :
  // auto-rename lu depuis auto-rename.json, ecriture via /auto-rename interdite.
  // Presente => mode NEON : config auto-rename PAR SERVEUR, modifiable depuis Discord
  // (avec fallback lecture fichier tant qu'une guild n'a rien en base).
  DATABASE_URL: z.string().min(1).optional(),

  // Environnement
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse et valide l'environnement. Leve une erreur explicite si invalide :
 * aucun catch silencieux, le boot doit echouer fort sur config manquante.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(racine)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${issues}`);
  }
  const e = parsed.data;
  return {
    discord: {
      token: e.DISCORD_TOKEN,
      applicationId: e.DISCORD_APPLICATION_ID,
      guildId: e.DISCORD_GUILD_ID,
    },
    autoRenameConfigPath: e.AUTO_RENAME_CONFIG_PATH,
    database: { url: e.DATABASE_URL },
    api: {
      port: e.PORT,
      host: e.HOST,
      statsToken: e.STATS_TOKEN,
      corsOrigins: e.CORS_ORIGINS?.split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
      rateLimit: { max: e.RATE_LIMIT_MAX, timeWindow: e.RATE_LIMIT_WINDOW_MS },
    },
    env: e.NODE_ENV,
    isDevelopment: e.NODE_ENV === 'development',
    isProduction: e.NODE_ENV === 'production',
    isTest: e.NODE_ENV === 'test',
  };
}

export interface Config {
  discord: {
    token: string;
    applicationId: string;
    guildId: string | undefined;
  };
  autoRenameConfigPath: string;
  /** URL Postgres Neon (B8, ADR-0005). Absente = mode fichier (dev). */
  database: { url: string | undefined };
  api: {
    port: number;
    host: string;
    /** Token Bearer protegeant /stats (CWE-306). Absent => /stats ouvert (dev). */
    statsToken: string | undefined;
    /** Origines CORS autorisees (CWE-306). Absent/vide => CORS desactive. */
    corsOrigins: string[] | undefined;
    /** Rate limit par IP (CWE-770). */
    rateLimit: { max: number; timeWindow: number };
  };
  env: Env['NODE_ENV'];
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}
