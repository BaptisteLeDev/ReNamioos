# Stack — ReNamioos

> Factuel, tiré du repo (`package.json`, `bun.lock`, `Dockerfile`, `.github/workflows/ci.yml`,
> `src/config.ts`). Versions = celles résolues dans le lockfile au 2026-06-11.

## Runtime

- **Bun 1.3.x** : exécute le TypeScript directement, aucun build pour lancer (`bun src/index.ts`).
  Image Docker `oven/bun:1.3-alpine`.
- **TypeScript 5.7.3** (`tsc --noEmit`, typecheck uniquement, mode strict).
- Module type ESM (`"type": "module"`).

## Dépendances (versions résolues — `bun.lock`)

| Lib | Range (`package.json`) | Résolue | Rôle |
|---|---|---|---|
| `discord.js` | `^14.16.3` | `14.26.4` | Client Discord, commandes slash, événements. Intents `Guilds` + `GuildMembers` (privilégié). |
| `fastify` | `^5.2.0` | `5.8.5` | API HTTP de supervision (`/health`, `/stats`). |
| `@fastify/cors` | `^10.0.1` | `10.1.0` | CORS de l'API. |
| `drizzle-orm` | `^0.45.2` | `0.45.2` | Typage + requêtes SQL contre Neon (`auto_rename_mappings`, command-sync). |
| `pg` | `^8.21.0` | `8.21.0` | Driver Postgres (pool, init paresseuse). |
| `zod` | `^3.24.1` | `3.25.76` | Validation config env (`src/config.ts`) et mapping fichier auto-rename. |

Dev : `@types/bun ^1.3.14`, `@types/pg ^8.20.0`, `typescript ^5.7.3`.

`@fastify/rate-limit` : ajouté sur la branche `fix/security-v1` (ADR-0006), pas encore sur `main`.

## Base de données

- **Neon Postgres** (projet `square-frost-15330405`). Activée par `DATABASE_URL`.
  - `auto_rename_mappings(guild_id, role_id, style_name, updated_at)`, PK `(guild_id, role_id)`.
  - Table de command-sync (instantané des commandes connues par serveur, `src/command-sync/`).
- Schéma drizzle (`src/db/schema.ts`) **reflète** un DDL déjà provisionné : aucune migration générée ici.
- **Sans `DATABASE_URL`** : mode fichier (dev), aucune connexion Postgres (init paresseuse `src/db/client.ts`).

## Ports et réseau

- **API** : `PORT=8199` par défaut, `HOST=0.0.0.0`. `GET /health` (public, sans I/O Discord) et
  `GET /stats` (métriques métier ; gaté par token Bearer sur `fix/security-v1`).

## Outillage test / CI / déploiement

- **Tests** : runner natif `bun test` (`bun:test`), pas Vitest (cf. ARCHITECTURE § Décision test runner).
  Tests colocalisés `*.test.ts`. Inclut un harnais de caractérisation porté du legacy.
- **Typecheck** : `bun run typecheck` (`tsc --noEmit`, strict).
- **Pas d'ESLint / Prettier / Biome** dans le repo : la qualité passe par tsc strict + tests.
- **CI** (`.github/workflows/ci.yml`, job `gate`) : `bun install --frozen-lockfile`, typecheck,
  `bun test`, `docker build`, smoke test conteneur (`/health` avec token Discord factice).
- **CD gated** (job `deploy`, `main` seulement) : runner rejoint le tailnet (clé OAuth Tailscale
  éphémère), appelle l'API Dokploy (`application.redeploy`). VPS dark, aucun webhook public.
- **Docker** : multi-étapes, étage `check` (typecheck + test au build), runtime non-root (`bun`),
  `HEALTHCHECK` via `bun -e fetch`, secrets déchiffrés par dotenvx (`.env.production` chiffré).

## Scripts (`package.json`)

```
bun run dev               # API + bot en watch
bun run start             # API + bot (src/index.ts)
bun run deploy-commands   # enregistre les commandes slash
bun run typecheck         # tsc --noEmit
bun test                  # suite bun:test
```
