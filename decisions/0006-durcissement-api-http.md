# ADR-0006 — Durcissement de l'API HTTP (auth /stats, CORS, rate limit, borne /convert)

- **Statut** : accepté · **Date** : 2026-06-11
- **Contexte amont** : audit de sécurité défensive (findings #22 CWE-306, #23 CWE-770,
  #24 CWE-20). L'API Fastify (`src/api/server.ts`) écoute sur `0.0.0.0` par défaut
  (`HOST`, `src/config.ts`) et expose `/health` et `/stats` au monitoring de la flotte
  (contrat publié cibles ↔ `bdf-monitor`, `monitoring/docs/contrat-cibles.md`).
- **Lien standards** : `bots/_standards/discord-bot-factory-standards.md` (conformité monitoring).
  Le pattern incriminé (`/stats` exposé sur `0.0.0.0` + `CORS origin: true` + pas de rate limit)
  vient du Template v2 et touche 4 bots. Voir « Centralisation » plus bas.

## Contexte

Trois faiblesses sur la couche HTTP, toutes à la frontière (le domaine de stylisation reste pur,
sans I/O ni dépendance réseau) :

1. **#22 (medium, CWE-306) — `/stats` exposé sans authentification, `CORS origin: true`.**
   `/stats` renvoie des métriques métier (nombre de serveurs, d'utilisateurs couverts, latence
   Discord). Sur `0.0.0.0`, n'importe qui sur le réseau pouvait les lire. `origin: true` reflétait
   en plus n'importe quelle origine cross-site.
2. **#23 (low, CWE-770) — pas de rate limit.** Aucune borne sur le nombre de requêtes par IP :
   un flot pouvait saturer l'API (le bootstrap démarre l'API avant le bot, `src/index.ts`).
3. **#24 (low, CWE-20) — texte `/convert` non borné injecté dans un embed.** La commande
   reprenait le texte utilisateur tel quel dans un field d'embed (limite Discord 1024 car/field),
   sans le valider ni le tronquer en amont.

## Décision

### 1. `/stats` gaté par token Bearer (hook `onRequest`), `/health` toujours public

- Quand `STATS_TOKEN` est configuré, `GET /stats` exige `Authorization: Bearer <STATS_TOKEN>`
  et répond `401` sinon. Le hook `onRequest` est posé sur la seule route `/stats`.
- **`/health` reste TOUJOURS public** : le contrat `bdf-monitor` impose une preuve de vie
  indépendante de l'auth (« seul le code HTTP compte »). Gater `/health` casserait le monitoring.
- **Comparaison en temps constant** (`node:crypto.timingSafeEqual`) pour ne pas fuiter le token
  par timing-attack ; une longueur différente est rejetée sans comparer les octets.
- **Rétro-compatibilité dev** : sans `STATS_TOKEN`, `/stats` reste ouvert (pas de friction en
  local). Le durcissement s'active par la présence de la variable d'environnement.

### 2. CORS verrouillé par allowlist

`CORS_ORIGINS` (liste séparée par virgules) remplace `origin: true`. Absent ou vide => CORS
désactivé (`origin: false`, aucune origine cross-site autorisée) au lieu de tout refléter.

### 3. Rate limit global par IP (`@fastify/rate-limit`)

Quota par défaut sûr (`RATE_LIMIT_MAX=100` / `RATE_LIMIT_WINDOW_MS=60000`), surchargeable par env.
Au-delà du quota : `429`.

### 4. Borne du texte `/convert` avant construction de l'embed

Constante `LIMITE_TEXTE_CONVERT = 500` dans le domaine (`src/domain/stylisation.ts`), nouvelle
erreur métier `texte-trop-long` traduite en message éphémère centralisé (`src/commands/styliser.ts`,
mandat anti-duplication). La validation se fait par **code point** (`[...texte].length`), cohérente
avec `tronquerPseudo`, AVANT tout `EmbedBuilder` : un texte trop long => refus propre éphémère,
jamais d'embed construit avec un payload non contrôlé.

## Conséquences

- L'API garde le pattern ports/adapters : `createApiServer` reçoit les paramètres de durcissement
  via `ApiServerOptions` (testable par `app.inject` sans Discord ni vrai réseau). La config
  (`src/config.ts`) reste la source unique de provenance des paramètres (zod).
- Nouvelles variables : `STATS_TOKEN`, `CORS_ORIGINS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`
  (toutes optionnelles, documentées dans `.env.example`).
- Tests ajoutés : `src/api/security.test.ts` (auth 401/200, longueur de token, `/health` public,
  CORS allowlist, 429) et 2 cas dans `src/commands/convert.test.ts` (texte trop long / limite).
- Alternative écartée : bind interne (`HOST=127.0.0.1`). Rejetée car `bdf-monitor` scrape `/stats`
  depuis un autre hôte ; le token Bearer + CORS allowlist protègent sans casser le monitoring.

## Centralisation (dette de flotte)

Le couple « `/stats` sur `0.0.0.0` + `CORS origin: true` + pas de rate limit » provient du
**Template v2** et est dupliqué sur ~4 bots. Le fix appliqué ici (token optionnel via hook
`onRequest`, CORS allowlist, `@fastify/rate-limit`, `/health` toujours public) devrait **remonter
dans `bots/_standards/` (section conformité monitoring) et dans le `Discord-TemplateBot`** pour
que les futurs bots héritent du durcissement par défaut. À tracer comme tâche transverse.
