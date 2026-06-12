# Architecture — ReNamioos (Bun / TypeScript)

> Décrit la structure du bot pilote ReNamioos, écrit en **Bun / TypeScript**. Les choix de fond
> sont figés dans les ADR : [`decisions/0001`](decisions/0001-langage-cible-reecriture.md)
> (langage cible) et [`decisions/0002`](decisions/0002-pattern-starter.md) (pattern du pilote).
> Le code source est entièrement dans `src/` ; le déploiement est conteneurisé (Dockerfile Bun)
> et automatisé par la CI (cf. § Déploiement).

## Vue d'ensemble

ReNamioos est un bot Discord de **stylisation de pseudos** (mappage Unicode) doublé d'une **API
HTTP** de supervision. Deux préoccupations, deux couches :

```
                    ┌─────────────────────────────────────────────┐
                    │                  src/index.ts                │
                    │   bootstrap : 1) API d'abord  2) bot ensuite  │
                    └───────────────┬──────────────┬───────────────┘
                                    │              │
                    ┌───────────────▼───┐   ┌──────▼────────────────┐
   contrat monitoring│   src/api/        │   │   src/client.ts       │ adapter Discord
   /health, /stats   │   (Fastify)       │◄──┤   BotClient           │ (implémente
                    │   server.ts       │   │   implements          │  StatsProvider)
                    │   stats-provider  │   │   StatsProvider       │
                    └───────────────────┘   └──────┬────────────────┘
                            ▲ port                  │ route les interactions
                            │ (pas de Discord.js)   │
                            │                ┌──────▼────────────────┐
                            │                │   src/commands/       │ adapters Discord
                            │                │   ping.ts, …          │
                            │                └──────┬────────────────┘
                            │                       │ traduisent vers
                            │                ┌──────▼────────────────┐
                            └────────────────┤   src/domain/         │ domaine PUR
                                             │   stylisation pseudo  │ (aucun import
                                             │   fonctions pures     │  discord.js)
                                             └───────────────────────┘
```

## Couches et dépendances (sens : vers l'intérieur)

| Couche | Dossier | Dépend de | Ne dépend PAS de |
|---|---|---|---|
| **Domaine** | `src/domain/` | rien | Discord.js, Fastify, I/O |
| **Provenance auto-rename** | `src/mapping/` (port + adapters), `src/db/` (schema + client) | domaine, drizzle/pg | Discord.js, Fastify |
| **Adapters Discord** | `src/commands/`, `src/events/`, `src/client.ts` | domaine, port `MappingStore`, Discord.js | Fastify, drizzle/pg |
| **API HTTP** | `src/api/` | port `StatsProvider` | **Discord.js** |
| **Composition** | `src/index.ts`, `src/config.ts`, `src/config/` | toutes | — |

### Anti-corruption layer (ACL) ciblée

Décision [ADR-0002](decisions/0002-pattern-starter.md) #2 : l'ACL est **ciblée**, pas un wrapper
complet de Discord.js. Elle protège **un seul invariant** : le modèle Discord (`Member`, `Role`,
`Interaction`) ne **fuit pas** dans `src/domain/`. Concrètement :

- `src/domain/` contient des **fonctions pures** (`convertirTexte(texte, style)`) et des value
  objects. Testables en mémoire, sans Discord ni réseau.
- `src/commands/*.ts` sont des **adapters** : ils extraient les primitives (texte, nom de style)
  d'une `Interaction`, appellent le domaine, reposent le résultat dans Discord.
- `src/api/` dépend du **port** `StatsProvider` (`src/api/stats-provider.ts`), pas de Discord.js.
  `BotClient` (`src/client.ts`) en est l'**adapter** concret. ⇒ le contrat `/stats` est testable
  sans connexion Discord (cf. `src/api/contract.test.ts`).

## Flux de données et provenance

- **Config** : une seule source de vérité, `src/config.ts` (zod). Charge et valide `process.env`
  (Bun lit le `.env` automatiquement). Aucun `process.env` lu ailleurs.
- **Stylisation** : les tables de glyphes (`src/domain/data/styles.json`) sont une **config fichier
  versionnée** ([ADR-0002](decisions/0002-pattern-starter.md) #3), chargée/validée au démarrage —
  **aucune DB**. Les commandes consomment le domaine, jamais les fichiers JSON bruts.
- **Auto-rename** ([ADR-0005](decisions/0005-config-auto-rename-neon.md), supersède
  [ADR-0004](decisions/0004-auto-rename.md)) : la config rôle→style est **par serveur** et
  modifiable depuis Discord. La **provenance** est centralisée derrière un **port unique**
  `MappingStore` (`src/mapping/`) : `Neon` si `DATABASE_URL` (table `auto_rename_mappings`,
  cache par guild invalidé à l'écriture), sinon **fichier** `auto-rename.json` (dev). En mode
  Neon, le fichier sert de **fallback lecture** tant qu'une guild n'a rien en base (transition).
  `/auto-rename`, `/aide` et `guildMemberUpdate` lisent **tous** ce port — jamais la source brute.
- **Journal d'auto-rename** (issue #28) : chaque tentative effective (succès/échec) est tracée
  derrière le **port unique** `AutoRenameLogStore` (`src/auto-rename-log/`) : ring-buffer **par
  guilde** (table `auto_rename_log`, purge au-delà de `CAPACITE_JOURNAL_PAR_GUILD`) en Neon, mémoire
  en dev. `guildMemberUpdate` l'alimente ; `/auto-rename log` (éphémère) le lit ; `getStats()` en
  dérive le compteur d'échecs du jour. Voir `src/auto-rename-log/README.md`.
- **Métriques** : `BotClient.getStats()` produit l'instantané `BotStats` consommé par `/stats`,
  dont `autoRenameFailuresToday` (compteur mémoire dérivé du journal, **sans I/O** : `getStats()`
  reste synchrone et rapide, invariant du contrat `/health`+`/stats`).

## Contrat de supervision (cibles ↔ bdf-monitor)

L'API implémente le **published language** du monitoring (`monitoring/docs/contrat-cibles.md`) :

| Endpoint | Rôle | Invariant |
|---|---|---|
| `GET /health` | preuve de vie | 2xx **rapide**, **sans I/O Discord** (répond même bot déconnecté) |
| `GET /stats` | métriques métier | objet JSON ; `guildCount` / `userCount` typés `number` (noms du contrat, **pas** `guilds`/`users`) |

Couplage **unidirectionnel** : ReNamioos ignore l'existence du monitoring, qui le *pull*. La
conformité est rejouable : `bun run contract http://<host>:<port>` depuis le repo monitoring.

## Auto-rename par rôles

Quand un membre **gagne** un rôle mappé, son pseudo est automatiquement stylisé. La config est
**par serveur** et modifiable depuis Discord ; décisions figées dans
[ADR-0005](decisions/0005-config-auto-rename-neon.md) (supersède
[ADR-0004](decisions/0004-auto-rename.md)). Le **domaine pur** ne change pas : seule la
**provenance** du mapping passe du fichier au port `MappingStore`.

```
 guildMemberUpdate (oldMember, newMember)        ── intent privilégié GuildMembers requis ──
            │
            ▼
 src/events/guild-member-update.ts  (ADAPTER)
   • mapping = MappingStore.list(guildId)                      ┐ provenance UNIQUE (par serveur)
   • extrait les ENSEMBLES d'IDs de rôles (avant/après)        │ traduction Discord → primitives
   • source = newMember.nickname ?? username (sourceRename)    ┘ (aucun objet Discord vers le domaine)
            │
            ▼
 src/domain/auto-rename.ts  (PUR, sans discord.js)
   • rolesAjoutes(avant, après) = après \ avant   (diff d'ensembles, PAS cardinalité)
   • styleDeclenche(...) → 1er roleId mappé dans l'ORDRE du mapping (= priorité), sinon null
            │ style | null
            ▼
 appliquerRename(membre, style, source)  (flux PARTAGÉ avec /rename & /random — anti-duplication)
   • hiérarchie → stylisation domaine → troncature 32 code points → member.edit(nick)
            │
            ▼
 échec (hiérarchie / permission Discord / refus propre 'rien-à-styliser')
   → log.warn STRUCTURÉ { guildId, memberId, style, raison }   (jamais d'exception, jamais de silence)
```

### Provenance : le port `MappingStore` (`src/mapping/`)

Une **seule** abstraction sait d'où vient la config rôle→style (mandat de provenance) :
`MappingStore` (`styleForRole`, `add`, `remove`, `list(guildId)`). Branché par `DATABASE_URL` :

| Mode | Adapter | Comportement |
|---|---|---|
| `DATABASE_URL` **présent** | `CompositeMappingStore` = `NeonMappingStore` + fallback fichier | config **par serveur** en Neon (table `auto_rename_mappings`, PK `(guild_id, role_id)`), **cache par guild invalidé à chaque écriture** ; fallback **lecture** sur le fichier tant qu'une guild n'a rien en base (transitoire) |
| `DATABASE_URL` **absent** | `FileMappingStore` | mode dev : lit `auto-rename.json`, **écriture refusée** (`/auto-rename add\|remove` lève une erreur) |

- **Neon** : `src/db/schema.ts` (table drizzle, reflète le DDL déjà provisionné — **aucune migration
  générée** ici) + `src/db/client.ts` (pool pg, **init paresseuse** : aucune connexion en mode
  fichier). Les requêtes drizzle (`src/mapping/neon-queries.ts`) sont **injectées** dans le
  `NeonMappingStore`, qui ne connaît que des promesses ⇒ cache et invalidation **testables sans DB**.
- **Cache chaud** : `guildMemberUpdate` est appelé à chaque changement de rôle de chaque membre ; le
  cache par guild évite un round-trip Postgres systématique. Invalidation **ciblée** : une écriture
  sur une guild ne vide pas le cache des autres.
- **Priorité = ordre d'ajout** : `selectByGuild` ordonne par `updated_at` croissant (équivalent Neon
  de « ordre des clés du fichier » d'ADR-0004). Le domaine pur reste inchangé.
- **Config fichier** (`src/config/auto-rename-config.ts`) : toujours chargée+validée au boot (zod
  `enum(STYLE_NAMES)`, échec fort si style inconnu). Sert de source unique en dev et de fallback
  lecture en mode Neon. Chemin = `AUTO_RENAME_CONFIG_PATH`. Exemple : `auto-rename.example.json`.

### Commande `/auto-rename` (admin)

`src/commands/auto-rename.ts` — adapter d'administration, permission **ManageGuild**
(`default_member_permissions` + revalidation dans `execute` ; refus propre **ephemeral** sinon et
hors serveur). `add` (option **ROLE native** + **style** parmi les 9 choix natifs de `STYLE_NAMES`),
`remove` (option ROLE), `list` (mappings de la guild, **aperçu** dérivé du domaine via `apercuStyle`).
La commande ne porte ni persistance (le store) ni stylisation (le domaine) : elle traduit, appelle,
confirme.

### Écarts et intent (inchangés vs B6)

- **Écarts volontaires vs legacy archivé** (cf. [`docs/caracterisation.md`](caracterisation.md),
  bugs n°6 et n°7) : (1) source = pseudo **serveur** sinon nom global (legacy : `after.name`
  toujours) ; (2) détection par **diff d'ensembles** (legacy : cardinalité). Les **retraits** ne
  déclenchent rien (auto-rename piloté par les **gains**).
- **Intent privilégié** : `guildMemberUpdate` n'est livré que si **SERVER MEMBERS INTENT**
  (`GatewayIntentBits.GuildMembers`) est activé dans le **Dev Portal Discord**. `src/client.ts` le
  demande en plus de `Guilds` ; sans lui, l'auto-rename est silencieusement inerte. Les autres
  intents restent minimaux.

## Bootstrap (ordre strict)

`src/index.ts` (standard `bots/_standards/`) :

1. **API d'abord** — `createApiServer` puis `listen`. Health/monitoring disponibles même si le bot
   échoue à se connecter.
2. **Bot ensuite** — `bot.start(token)`. Un échec de login Discord **ne fait pas tomber l'API**
   (try/catch loggé, pas de catch silencieux).
3. Arrêt propre sur SIGINT/SIGTERM (`bot.destroy()` + `api.close()`).

## Runtime et outillage

- **Bun 1.3.x** exécute le TypeScript directement : pas de build `tsc` pour lancer (`bun src/index.ts`).
  `tsc --noEmit` sert **uniquement au typecheck** (`bun run typecheck`), en mode strict (aligné sur le template).
- **Tests** : `bun test` (runner natif `bun:test`). Choix vs Vitest : voir
  [§ Décision test runner](#décision-test-runner).
- **HTTP** : Fastify (standard flotte ; Elysia réservé au monitoring).
- **Discord** : Discord.js 14, intents `Guilds` + `GuildMembers` (**privilégié**, requis par
  l'auto-rename — cf. § Auto-rename).

### Décision test runner

**`bun:test` natif** (et non Vitest). Raisons : zéro dépendance et zéro config (Vitest tirerait
vitest + plugins), exécution directe du TS sous Bun (cohérent avec le runtime de prod), suite
rapide (~0,4 s). Le harnais de caractérisation porté depuis le legacy utilise le même runner. Si un besoin
spécifique de Vitest apparaît (UI, coverage avancé), il sera tranché par un ADR dédié.

## Déploiement

Conteneurisé et automatisé. Décisions figées côté flotte (ADR-0005 monitoring, `DECISIONS.md`
D6/D13/D14).

- **Image** : `Dockerfile` multi-étapes sur `oven/bun:1.3-alpine` (version alignée sur la flotte).
  Un étage `check` lance `typecheck` + `bun test` **au build** : pas d'image si le code est rouge.
  L'étage runtime tourne en non-root (utilisateur `bun`), expose le **port 8199** et embarque un
  `HEALTHCHECK` qui interroge `GET /health` (via `bun -e fetch(...)`, pas de curl). Les secrets sont
  déchiffrés au démarrage par dotenvx (`.env.production` chiffré, clé fournie par Dokploy, D7).
- **CI gate** (`.github/workflows/ci.yml`, job `gate`) : sur chaque push/PR, `bun install --frozen-lockfile`,
  `typecheck`, `bun test`, `docker build`, puis **smoke test** du conteneur (l'API sert `/health`
  même avec un token Discord factice, le bootstrap démarrant l'API avant le login).
- **CD gated** (job `deploy`) : uniquement sur `main` et uniquement si le gate est vert. Le VPS reste
  **dark** (aucun webhook public) : le runner rejoint le **tailnet** via une clé OAuth éphémère
  Tailscale, puis appelle l'API Dokploy (`application.redeploy`). Couplage tiré par le déployeur,
  pas exposé.

## Arborescence

```
ReNamioos/
├── decisions/                   # ADR (0001 langage, 0002 pattern, 0003 corrections, 0004 auto-rename fichier, 0005 auto-rename Neon)
├── docs/
│   ├── caracterisation.md       # archive : comportement du legacy Python (supprimé à la B7)
│   └── stories.md               # user stories
├── auto-rename.json             # config auto-rename (roleId → styleName), versionnée
├── auto-rename.example.json     # exemple de mapping auto-rename (placeholders)
├── src/
│   ├── index.ts                 # bootstrap (charge config auto-rename, puis API, puis bot)
│   ├── config.ts                # config zod env (seule source d'env, dont DATABASE_URL optionnelle)
│   ├── config/
│   │   └── auto-rename-config.ts # chargeur+validation du mapping fichier roleId → styleName
│   ├── db/                      # schema.ts (table drizzle), client.ts (pool pg/Neon, init paresseuse)
│   ├── mapping/                 # store.ts (port), neon-store/neon-queries/file-store/composite-store, index.ts (compo)
│   ├── client.ts                # BotClient (adapter Discord, abonne guildMemberUpdate, StatsProvider)
│   ├── deploy-commands.ts       # enregistrement des commandes slash
│   ├── api/                     # server.ts, stats-provider.ts (port), contract.test.ts
│   ├── commands/                # types.ts, index.ts (fabrique), ping/styles/convert/rename/random/auto-rename/aide, styliser.ts
│   ├── events/
│   │   └── guild-member-update.ts # adapter auto-rename (événement → MappingStore → domaine → appliquerRename)
│   └── domain/
│       ├── data/styles.json     # tables de glyphes (provenance données, config versionnée)
│       ├── styles.ts            # provenance données (charge data/styles.json)
│       ├── stylisation.ts       # pipeline pur de stylisation
│       ├── auto-rename.ts       # logique pure auto-rename (diff d'ensembles + priorité)
│       └── README.md            # domaine pur (langage ubiquitaire, API, invariants)
├── Dockerfile                   # image Bun (oven/bun:1.3-alpine), gate typecheck/test au build
├── .dockerignore
├── .github/workflows/ci.yml     # gate qualité + CD gated (tailnet → Dokploy)
├── package.json                 # runtime bun, scripts dev/start/test/typecheck/deploy-commands
├── tsconfig.json                # strict, noEmit (typecheck only)
└── .env.example                 # placeholders (jamais de secret réel)
```

## Conventions

- **Tout fichier domaine** (`src/domain/`) : fonctions pures, aucun `import` de `discord.js`.
- **Toute commande** : un fichier `src/commands/<nom>.ts` exportant un `Command`, ajouté au registre
  `src/commands/index.ts`. La logique métier va dans le domaine, l'adapter traduit.
- **Tout endpoint** : ajouté dans `src/api/server.ts` ; toute donnée Discord passe par le port
  `StatsProvider`.
- **Tests colocalisés** : `*.test.ts` à côté du fichier testé, exécutés par `bun test`.
- **Config** : toute nouvelle variable d'env est ajoutée au schéma zod de `src/config.ts` ET à
  `.env.example` (placeholder).
