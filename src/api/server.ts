/**
 * Serveur API Fastify de ReNamioos.
 *
 * Expose le contrat cibles ↔ bdf-monitor (monitoring/docs/contrat-cibles.md) :
 *   - GET /health : preuve de vie. 2xx rapide, SANS I/O Discord.
 *   - GET /stats  : metriques metier (guildCount / userCount / ...).
 *   - GET /       : info API (racine).
 *
 * L'API ne depend pas de Discord.js : elle recoit un StatsProvider (port). C'est
 * l'ACL ciblee — le modele Discord ne fuit pas dans la couche HTTP.
 */
import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { StatsProvider } from './stats-provider';

export interface RateLimitOptions {
  /** Nombre max de requetes par fenetre et par IP. */
  max: number;
  /** Fenetre glissante en millisecondes. */
  timeWindow: number;
}

export interface ApiServerOptions {
  statsProvider: StatsProvider;
  /** Active les logs Fastify (desactives en test pour une sortie propre). */
  logger?: boolean;
  /**
   * Token Bearer protegeant GET /stats (finding #22, CWE-306). Absent =>
   * /stats reste ouvert (mode dev / retro-compat). /health reste TOUJOURS public
   * (invariant du contrat bdf-monitor : preuve de vie independante de l'auth).
   */
  statsToken?: string | undefined;
  /**
   * Allowlist d'origines CORS (finding #22). Absente ou vide => CORS desactive
   * (aucune origine cross-site autorisee), au lieu de l'ancien `origin: true`
   * qui refletait n'importe quelle origine.
   */
  corsOrigins?: string[] | undefined;
  /** Parametres du rate limit (finding #23, CWE-770). Absent => defauts surs. */
  rateLimit?: RateLimitOptions | undefined;
}

/**
 * Comparaison en temps constant du token (anti timing-attack). Encode les deux
 * chaines en buffers ; une difference de longueur est rejetee sans comparer les
 * octets (timingSafeEqual exige des longueurs egales).
 */
function tokenValide(attendu: string, recu: string): boolean {
  const a = Buffer.from(attendu);
  const b = Buffer.from(recu);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Extrait le token d'un header `Authorization: Bearer <token>`. */
function extraireBearer(header: string | undefined): string | undefined {
  if (header === undefined) return undefined;
  const prefixe = 'Bearer ';
  return header.startsWith(prefixe) ? header.slice(prefixe.length) : undefined;
}

/**
 * Construit et configure l'instance Fastify (sans l'ecouter : le bootstrap
 * appelle `.listen`). Retourne l'instance pour permettre `.inject` en test.
 */
export async function createApiServer(options: ApiServerOptions): Promise<FastifyInstance> {
  const { statsProvider, logger = false, statsToken, corsOrigins, rateLimit: rl } = options;

  const app = Fastify({ logger });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    void reply.status(error.statusCode ?? 500).send({ error: 'Internal Server Error' });
  });

  // CORS verrouille (finding #22) : on ne reflete plus n'importe quelle origine.
  // Sans allowlist explicite, aucune origine cross-site n'est autorisee.
  await app.register(cors, { origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : false });

  // Rate limit global par IP (finding #23, CWE-770). Defauts surs si non fourni.
  await app.register(rateLimit, {
    max: rl?.max ?? 100,
    timeWindow: rl?.timeWindow ?? 60_000,
  });

  // Racine — info API.
  app.get('/', () => ({
    name: 'ReNamioos API',
    endpoints: { health: '/health', stats: '/stats' },
  }));

  // Preuve de vie. Ne touche PAS Discord : repond immediatement (invariant contrat).
  // TOUJOURS public, meme quand /stats est gate (contrat bdf-monitor).
  app.get('/health', () => ({ status: 'ok', uptime: process.uptime() }));

  // Metriques metier — noms imposes par le contrat publie. Gate par Bearer token
  // si statsToken est configure (finding #22, CWE-306). Comparaison en temps constant.
  app.get('/stats', { onRequest: gateStats(statsToken) }, () => statsProvider.getStats());

  await app.ready();
  return app;
}

/**
 * Hook onRequest gardant /stats. Si aucun token n'est configure, laisse passer
 * (mode dev). Sinon exige `Authorization: Bearer <statsToken>`, compare en temps
 * constant, et repond 401 sinon.
 */
function gateStats(statsToken: string | undefined) {
  return (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply, done: (err?: Error) => void): void => {
    if (statsToken === undefined) {
      done();
      return;
    }
    const recu = extraireBearer(request.headers.authorization);
    if (recu === undefined || !tokenValide(statsToken, recu)) {
      void reply.status(401).send({ error: 'Unauthorized' });
      return;
    }
    done();
  };
}
