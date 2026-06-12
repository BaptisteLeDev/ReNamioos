# Patterns d'architecture appliqués — ReNamioos

> Patterns réellement présents dans CE repo, avec fichiers d'ancrage. Détail prose dans
> [`../../ARCHITECTURE.md`](../../docs/ARCHITECTURE.md), [`../../src/domain/README.md`](../../src/domain/README.md),
> [`../../src/mapping/README.md`](../../src/mapping/README.md).

## Ports & adapters (hexagonal)

- **Port `StatsProvider`** (`src/api/stats-provider.ts`) : l'API HTTP en dépend, jamais de Discord.js.
  Adapter concret = `BotClient` (`src/client.ts`). Contrat `/stats` testable sans Discord
  (`src/api/contract.test.ts`).
- **Port `MappingStore`** (`src/mapping/store.ts`) : provenance unique de la config auto-rename.
  Adapters : `NeonMappingStore`, `FileMappingStore`, `CompositeMappingStore`. Composition par
  `creerMappingStore` (`src/mapping/index.ts`) selon `DATABASE_URL`.
- **Port `CommandSyncStore`** (`src/command-sync/store.ts`) : provenance unique de l'instantané
  « commandes connues par serveur » pour la commande `/update`. Mêmes adapters Neon/fichier que
  MappingStore. (Pas encore décrit dans `ARCHITECTURE.md`.)

## Anti-corruption layer ciblée

- Protège **un seul invariant** : le modèle Discord (`Member`, `Role`, `Interaction`) ne fuit pas
  dans `src/domain/`. Les `src/commands/*.ts` et `src/events/guild-member-update.ts` extraient des
  primitives, appellent le domaine, reposent le résultat. Pas de wrapper complet de Discord.js
  (ADR-0002 #2).

## Value object / résultat discriminé

- `convertirTexte` (`src/domain/stylisation.ts`) renvoie un `ResultatStylisation` discriminé
  (`{ ok: true; texte }` | `{ ok: false; erreur }`) plutôt que de lever ou de renvoyer une chaîne
  ambiguë. Rend le « refus propre » (style inconnu, rien à styliser, texte trop long) explicite et typé.

## Composite + cache + fallback (provenance données)

- `CompositeMappingStore` (`src/mapping/composite-store.ts`) = Neon en écriture + **fallback lecture**
  fichier tant qu'une guild n'a rien en base (transitoire).
- `NeonMappingStore` (`src/mapping/neon-store.ts`) : cache **par guild**, invalidation **ciblée** à
  l'écriture. Reçoit `MappingQueries` par **injection** (`neon-queries.ts`) ⇒ cache et invalidation
  testables sans DB (`neon-store.test.ts`).
- Init paresseuse du pool Postgres (`src/db/client.ts`) : aucune connexion en mode fichier.

## Domaine pur testable en mémoire

- `src/domain/auto-rename.ts` : `rolesAjoutes` (diff d'ENSEMBLES, pas cardinalité), `styleDeclenche`
  (1er rôle mappé dans l'ordre = priorité). Aucun import Discord. Suite de caractérisation portée du
  legacy Python (`stylisation.test.ts`, écarts B4 marqués `ÉCART VOLONTAIRE`).

## Flux de rename partagé (anti-duplication)

- `appliquerRename` / helpers `src/commands/styliser.ts` : flux unique (hiérarchie → stylisation
  domaine → troncature 32 code points → `member.edit`) **partagé** par `/rename`, `/random` et
  l'événement `guildMemberUpdate`. Logs d'échec structurés, jamais d'exception silencieuse.

## Bootstrap API-d'abord

- `src/index.ts` : 1) API (`createApiServer` + `listen`), 2) bot (`bot.start`). Un échec de login
  Discord ne fait pas tomber l'API. Arrêt propre SIGINT/SIGTERM.

## Config centralisée (single source of truth)

- `src/config.ts` (zod) : seule lecture de `process.env`. Aucun `process.env` ailleurs.
  Config fichier auto-rename validée au boot (`src/config/auto-rename-config.ts`, zod `enum(STYLE_NAMES)`).
