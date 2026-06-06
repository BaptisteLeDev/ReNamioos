# Changelog

Toutes les évolutions notables de ReNamioos. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage
[SemVer](https://semver.org/lang/fr/).

## [2.0.0] - 2026-06-06

Réécriture complète en **Bun / TypeScript** (Discord.js 14). ReNamioos devient le
bot **pilote** de la flotte et fige le pattern des réécritures suivantes
(ADR-0001, ADR-0002). La v1 Python (`discord.py`) est archivée (voir ci-dessous).

La réécriture s'est faite par lots B0 à B8, derrière des tests de caractérisation
qui figent le comportement observé du legacy avant de le réimplémenter.

### Ajouté

- Domaine de stylisation **pur** (`src/domain/`), isolé de Discord.js : pipeline
  `convertirTexte` (nettoyage, conversion chiffres, capitalisation, mappage de style),
  testable en mémoire sans réseau.
- **API HTTP de supervision** (`/health`, `/stats`) sur Fastify, derrière le port
  `StatsProvider`. Contrat figé par des tests d'acceptation alignés sur le Published
  Language du monitoring de flotte (`monitoring/docs/contrat-cibles.md`). `/health`
  répond sans connexion Discord ; la version exposée par `/stats` provient d'une
  source unique (`package.json`).
- **Auto-rename par serveur configurable depuis Discord** (`/auto-rename add|remove|list`),
  réservé aux admins `Manage Server`. La provenance des mappings rôle→style est
  centralisée derrière un port unique `MappingStore` (ADR-0005).
- Mode **Neon** (Postgres) : config auto-rename multi-serveur, persistante, sans
  redéploiement (table `auto_rename_mappings`, clé `(guild_id, role_id)`). En l'absence
  de mapping Neon pour un serveur, repli en lecture sur le fichier `auto-rename.json`
  (transitoire).
- Mode **fichier** (développement) : mapping `auto-rename.json` validé par zod au boot,
  chemin configurable via `AUTO_RENAME_CONFIG_PATH`.
- Commandes slash : `/ping`, `/styles`, `/convert`, `/rename`, `/random`, `/auto-rename`,
  `/aide`.
- Conteneurisation **Docker** (image Bun) avec gate typecheck + tests au build, et
  pipeline **CI/CD** (gate qualité puis déploiement).
- Documentation : `README.md`, `ARCHITECTURE.md`, `src/domain/README.md`, ADR 0001 à 0005,
  caractérisation du legacy et user stories (`docs/`).

### Modifié

- Troncature des pseudos à 32 caractères désormais **par code point**
  (`[...str].slice(0, 32)`), les glyphes stylisés étant majoritairement hors BMP.
- Conversion des chiffres étendue aux **10** chiffres (corrige les `2`, `6`, `9`
  non convertis du legacy ; ADR-0003).

### Migration depuis la v1

- ReNamioos ne s'exécute plus avec Python : installer **Bun 1.3.x**, puis `bun install`.
- Le runtime, les commandes slash et la config sont nouveaux : suivre le `README.md`.
- La config auto-rename n'est plus codée en dur : en production (Neon), la recréer via
  `/auto-rename` ; en développement, éditer `auto-rename.json`.

## [1.0.0] - legacy Python (archive)

Version d'origine en **Python** (`discord.py`), monolithique, sans tests, logique métier
mêlée à la couche Discord. Plusieurs comportements non documentés (non-idempotence du
renommage, perte d'accents en bord, chiffres `2`/`6`/`9` non convertis). Conservée comme
référence historique et caractérisée dans `docs/caracterisation.md` avant la réécriture v2.
Non maintenue.

[2.0.0]: https://github.com/BaptisteLeDev/ReNamioos/releases/tag/v2.0.0
