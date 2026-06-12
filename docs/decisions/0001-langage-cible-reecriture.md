# ADR-0001 — Langage cible de la réécriture des bots : Bun/TypeScript

- **Statut** : accepté · **Date** : 2026-06-04

## Contexte

Les bots Discord de la flotte BotDiscordFactory existent dans des états hétérogènes.
ReNamioos est écrit en **Python** (`discord.py`), sans tests, avec une logique métier
mêlée à la couche Discord et plusieurs comportements non documentés (voir
[`docs/caracterisation.md`](../caracterisation.md)). Une réécriture est décidée ;
il faut trancher le **langage et l'écosystème cibles** pour l'ensemble des bots, et
choisir un **bot pilote** qui fige le pattern.

Deux options crédibles :
- **Bun / TypeScript** avec Discord.js 14 — l'écosystème déjà présent dans la flotte.
- **Rust + serenity** — performant, mais nouvel écosystème sans base existante ici.

## Décision

**Langage cible = Bun / TypeScript (Discord.js 14).** La réécriture suit le pattern du
template `Discord-TemplateBot` et les conventions de `bots/_standards/`.

**Bot pilote = ReNamioos.** Il « essuie les plâtres » et **fige le pattern** pour les
bots suivants, en tranchant notamment :
- **starter copié depuis le template** vs **librairie partagée** (couche commune) ;
- structure **DDD adaptée Discord** (domaine pur « stylisation de pseudo » isolé de
  l'adaptateur Discord.js) ;
- **anti-corruption layer** entre le domaine et Discord.js (le modèle Discord ne fuit
  pas dans le domaine).

Raisons :
- **Cohérence de flotte** : Moodioos est déjà en TS, le monitoring est en Bun/Elysia.
  Un **seul** écosystème à maintenir, déployer et outiller.
- **Capital existant** : un **template** (`Discord-TemplateBot`) et des **standards**
  (`bots/_standards/`) sont déjà en place pour TS — rien d'équivalent pour Rust.
- **Coût d'un 2ᵉ écosystème** : Rust+serenity imposerait une seconde chaîne (toolchain,
  CI, images Docker, savoir-faire) sans template ni standards, pour un domaine (mappage
  de caractères + handlers Discord) qui ne réclame ni les perfs ni la sûreté mémoire de
  Rust.

## Conséquences

- La logique pure de ReNamioos (pipeline `convertir_texte` : nettoyage → conversion
  chiffres → capitalisation → mappage de style) est réécrite en TS **derrière les tests
  de caractérisation** ([`tests/`](../../tests/)), qui décrivent le comportement **actuel**
  et servent de filet pour la nouvelle implémentation.
- Le pattern figé par ReNamioos (structure, ACL, packaging starter-vs-lib) devient la
  **référence** des réécritures suivantes — un seul endroit pour faire évoluer le socle.
- Les **bugs pinnés** (non-idempotence destructrice, accents en bord perdus, `scriptify`
  fantôme dans l'UI, chiffres 2/6/9 non convertis, commandes `!` inexistantes — détail
  dans `docs/caracterisation.md`) sont des **décisions explicites** au moment de la
  réécriture : reproduire à l'identique ou corriger en connaissance de cause, jamais par
  accident.
- Point de vigilance technique transféré au pilote : la **troncature à 32 caractères**
  doit se faire **par code point** en JS/TS (`[...str].slice(0, 32)`), les glyphes
  stylisés étant majoritairement hors BMP.
- Un seul écosystème pour CI/CD, images Docker, monitoring (cohérent avec
  `monitoring/decisions/0001-topologie-git.md` : 1 composant = 1 repo + 1 projet Docker).

## Alternatives écartées

- **Rust + serenity** : 2ᵉ écosystème à maintenir, **sans template ni standards** dans la
  flotte ; gains (perfs, sûreté mémoire) non justifiés par le domaine ; rompt la cohérence
  TS/Bun déjà établie (Moodioos, monitoring Elysia).
- **Garder Python (`discord.py`)** : 3ᵉ écosystème de fait, hors de la trajectoire de
  cohérence ; pas de template ni de standards Python dans la flotte.
- **Lib partagée d'emblée** (avant le pilote) : abstraction non méritée (règle de 3) tant
  qu'un seul bot a été réécrit. Le choix starter-vs-lib est précisément ce que le pilote
  doit trancher sur preuve, pas par anticipation.
