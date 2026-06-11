# Standards de code — ReNamioos

> Pointe vers la config réelle du repo. Pas de réinvention de règles : il n'y a **ni ESLint, ni
> Prettier, ni Biome** dans ReNamioos. La discipline vient de `tsc` strict + tests + conventions
> de couche documentées dans `ARCHITECTURE.md`.

## Config de référence (source de vérité)

- [`../../tsconfig.json`](../../tsconfig.json) : mode **strict** complet. Notable :
  `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
  `exactOptionalPropertyTypes`, `allowUnreachableCode: false`. `noEmit` (typecheck seul, Bun exécute le TS).
  `moduleResolution: bundler`, `allowImportingTsExtensions: true` (imports avec extension `.ts`),
  `verbatimModuleSyntax: true` (imports de types explicites : `import type`).
- [`../../package.json`](../../package.json) : scripts `typecheck` et `test` = le gate qualité.
- [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) : ce que la CI exige réellement.

## Conventions observées (ARCHITECTURE.md § Conventions)

- **Domaine pur** (`src/domain/`) : fonctions pures, **aucun** `import` de `discord.js` / Fastify / I/O.
- **Commandes** : un fichier `src/commands/<nom>.ts` exportant un `Command`, ajouté au registre
  `src/commands/index.ts`. L'adapter traduit l'`Interaction`, le domaine porte la logique.
- **Endpoints API** : ajoutés dans `src/api/server.ts` ; toute donnée Discord passe par le port `StatsProvider`.
- **Provenance** : aucun consommateur ne lit `auto-rename.json` ni la table en direct ; tout passe
  par un port (`MappingStore`, `CommandSyncStore`).
- **Tests colocalisés** : `*.test.ts` à côté du fichier testé.
- **Config env** : toute nouvelle variable est ajoutée au schéma zod de `src/config.ts` ET à `.env.example`.
- **Langue** : code et identifiants majoritairement en **français** (langage ubiquitaire métier :
  `convertirTexte`, `rolesAjoutes`, `styleDeclenche`, `appliquerRename`).
- **Imports avec extension `.ts`** explicite (contrainte `allowImportingTsExtensions`).
- **Troncature pseudo** : 32 **code points** via `[...str].slice(0, 32)`, jamais `str.slice` (glyphes hors BMP).

## Ce qui n'existe PAS (ne pas inventer)

- Pas de linter/formatter configuré : ne pas référencer une config `.eslintrc` / `biome.json` / `.prettierrc` inexistante.
- Pas de migrations drizzle générées : `src/db/schema.ts` est descriptif (DDL provisionné hors repo).
