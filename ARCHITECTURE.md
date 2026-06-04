# Architecture — ReNamioos (réécriture Bun / TypeScript)

> Décrit la structure de la **réécriture TS** du bot pilote ReNamioos. Les choix de fond sont
> figés dans les ADR : [`decisions/0001`](decisions/0001-langage-cible-reecriture.md) (langage cible)
> et [`decisions/0002`](decisions/0002-pattern-starter.md) (pattern du pilote). Pendant la
> transition, le legacy Python (`bot.py`) coexiste, intact, jusqu'à la bascule (B7).

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
                            └────────────────┤   src/domain/  (B3)   │ domaine PUR
                                             │   stylisation pseudo  │ (aucun import
                                             │   fonctions pures     │  discord.js)
                                             └───────────────────────┘
```

## Couches et dépendances (sens : vers l'intérieur)

| Couche | Dossier | Dépend de | Ne dépend PAS de |
|---|---|---|---|
| **Domaine** | `src/domain/` | rien | Discord.js, Fastify, I/O |
| **Adapters Discord** | `src/commands/`, `src/client.ts` | domaine, Discord.js | Fastify |
| **API HTTP** | `src/api/` | port `StatsProvider` | **Discord.js** |
| **Composition** | `src/index.ts`, `src/config.ts` | toutes | — |

### Anti-corruption layer (ACL) ciblée

Décision [ADR-0002](decisions/0002-pattern-starter.md) #2 : l'ACL est **ciblée**, pas un wrapper
complet de Discord.js. Elle protège **un seul invariant** : le modèle Discord (`Member`, `Role`,
`Interaction`) ne **fuit pas** dans `src/domain/`. Concrètement :

- `src/domain/` (B3) contient des **fonctions pures** (`convertirTexte(texte, style)`) et des value
  objects. Testables en mémoire, sans Discord ni réseau.
- `src/commands/*.ts` sont des **adapters** : ils extraient les primitives (texte, nom de style)
  d'une `Interaction`, appellent le domaine, reposent le résultat dans Discord.
- `src/api/` dépend du **port** `StatsProvider` (`src/api/stats-provider.ts`), pas de Discord.js.
  `BotClient` (`src/client.ts`) en est l'**adapter** concret. ⇒ le contrat `/stats` est testable
  sans connexion Discord (cf. `src/api/contract.test.ts`).

## Flux de données et provenance

- **Config** : une seule source de vérité, `src/config.ts` (zod). Charge et valide `process.env`
  (Bun lit le `.env` automatiquement). Aucun `process.env` lu ailleurs.
- **Stylisation** (B3) : les tables de glyphes (`styles.json`) et le mapping rôles→styles
  (successeur de `role.json`) sont une **config fichier versionnée** ([ADR-0002](decisions/0002-pattern-starter.md) #3),
  chargée/validée au démarrage — **aucune DB**. Les commandes consomment le domaine, jamais les
  fichiers JSON bruts.
- **Métriques** : `BotClient.getStats()` produit l'instantané `BotStats` consommé par `/stats`.

## Contrat de supervision (cibles ↔ bdf-monitor)

L'API implémente le **published language** du monitoring (`monitoring/docs/contrat-cibles.md`) :

| Endpoint | Rôle | Invariant |
|---|---|---|
| `GET /health` | preuve de vie | 2xx **rapide**, **sans I/O Discord** (répond même bot déconnecté) |
| `GET /stats` | métriques métier | objet JSON ; `guildCount` / `userCount` typés `number` (noms du contrat, **pas** `guilds`/`users`) |

Couplage **unidirectionnel** : ReNamioos ignore l'existence du monitoring, qui le *pull*. La
conformité est rejouable : `bun run contract http://<host>:<port>` depuis le repo monitoring.

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
- **Discord** : Discord.js 14, intent `Guilds`.

### Décision test runner

**`bun:test` natif** (et non Vitest). Raisons : zéro dépendance et zéro config (Vitest tirerait
vitest + plugins), exécution directe du TS sous Bun (cohérent avec le runtime de prod), suite
rapide (~0,4 s). Le harnais de caractérisation porté en B3 utilisera le même runner. Si un besoin
spécifique de Vitest apparaît (UI, coverage avancé), il sera tranché par un ADR dédié.

## Arborescence

```
ReNamioos/                       (worktree feat/rewrite-bun)
├── decisions/                   # ADR (0001 langage, 0002 pattern pilote)
├── docs/caracterisation.md      # comportement legacy de référence (B0)
├── tests/                       # harnais Python de caractérisation (legacy, porté en B3)
├── src/
│   ├── index.ts                 # bootstrap (API puis bot)
│   ├── config.ts                # config zod (seule source d'env)
│   ├── client.ts                # BotClient (adapter Discord, implements StatsProvider)
│   ├── deploy-commands.ts       # enregistrement des commandes slash
│   ├── api/
│   │   ├── server.ts            # factory Fastify (/health, /stats, /)
│   │   ├── stats-provider.ts    # port StatsProvider + type BotStats
│   │   └── contract.test.ts     # tests d'acceptation du contrat monitoring
│   ├── commands/
│   │   ├── types.ts             # type Command (data + execute)
│   │   ├── index.ts             # registre des commandes
│   │   ├── ping.ts              # commande /ping (tracer bullet)
│   │   └── ping.test.ts         # test d'acceptation /ping
│   └── domain/
│       └── README.md            # domaine pur — IMPLÉMENTÉ EN B3 (vide pour l'instant)
├── package.json                 # runtime bun, scripts dev/test/typecheck/deploy-commands
├── tsconfig.json                # strict, noEmit (typecheck only)
├── .env.example                 # placeholders (jamais de secret réel)
└── (legacy Python : bot.py, styles.json, role.json, … intacts jusqu'à B7)
```

## Conventions pour la suite (B3 et au-delà)

- **Tout fichier domaine** (`src/domain/`) : fonctions pures, aucun `import` de `discord.js`.
- **Toute commande** : un fichier `src/commands/<nom>.ts` exportant un `Command`, ajouté au registre
  `src/commands/index.ts`. La logique métier va dans le domaine, l'adapter traduit.
- **Tout endpoint** : ajouté dans `src/api/server.ts` ; toute donnée Discord passe par le port
  `StatsProvider`.
- **Tests colocalisés** : `*.test.ts` à côté du fichier testé, exécutés par `bun test`.
- **Config** : toute nouvelle variable d'env est ajoutée au schéma zod de `src/config.ts` ET à
  `.env.example` (placeholder).
