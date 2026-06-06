# ReNamioos — image Bun (cf. decisions/0004-auto-rename.md, ADR-0005 monitoring, DECISIONS.md D6/D14).
# Version alignee sur la flotte (monitoring/Dockerfile : oven/bun:1.3-alpine).
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# --- dependances completes (cache docker sur le lockfile) : sert au gate de build ---
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- gate au build : typecheck + tests (pas d'image si rouge) ---
FROM deps AS check
COPY tsconfig.json ./
COPY src ./src
RUN bun run typecheck && bun test

# --- dependances de production uniquement (image runtime minimale) ---
FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
# dotenvx dechiffre .env.production au demarrage (DOTENV_PRIVATE_KEY fournie par Dokploy, D7).
RUN bun add --global @dotenvx/dotenvx
COPY --from=prod-deps /app/node_modules ./node_modules
# package.json est importe au runtime (src/client.ts : version de /stats).
# auto-rename.json = config versionnee chargee au boot (ADR-0004, AUTO_RENAME_CONFIG_PATH defaut).
# .env.production* en glob : la COPY reussit meme tant que le fichier chiffre n'existe pas encore.
COPY package.json auto-rename.json .env.production* ./
COPY src ./src

# Le boot demarre l'API d'abord (src/index.ts) : /health repond sans I/O Discord.
EXPOSE 8199

# Non-root : oven/bun fournit l'utilisateur `bun` (uid 1000).
USER bun

# HEALTHCHECK sur GET /health (port 8199, src/config.ts). Bun est dans l'image :
# pas besoin de curl/wget. Sortie non nulle si /health ne repond pas 2xx.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:8199/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["dotenvx", "run", "-f", ".env.production", "--", "bun", "src/index.ts"]
