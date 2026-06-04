# ADR-0002 — Pattern du pilote : starter copié, ACL ciblée domaine, config fichier

- **Statut** : accepté · **Date** : 2026-06-04
- **Contexte amont** : [ADR-0001](0001-langage-cible-reecriture.md) (Bun/TS, ReNamioos pilote)

## Contexte

[ADR-0001](0001-langage-cible-reecriture.md) a tranché le langage (Bun/TypeScript,
Discord.js 14) et désigné **ReNamioos** comme bot pilote chargé de **figer le pattern**
de réécriture pour le reste de la flotte. Trois questions restaient explicitement
ouvertes, à trancher **sur preuve** plutôt que par anticipation :

1. **Packaging du socle** : copier le template `Discord-TemplateBot` dans chaque bot,
   ou extraire d'emblée une **librairie partagée** (couche commune) ?
2. **Forme de l'anti-corruption layer (ACL)** entre le domaine « stylisation de pseudo »
   et Discord.js : wrapper complet de Discord.js, ou frontière ciblée ?
3. **Persistance** du mapping rôles→styles (successeur de `role.json`) : base de données
   (Neon) ou config fichier versionnée ?

Le domaine de ReNamioos (cf. [`docs/caracterisation.md`](../docs/caracterisation.md)) est
un **mappage de caractères pur** (pipeline `convertir_texte` : nettoyage → conversion
chiffres → capitalisation → mappage de style) plus une poignée de handlers Discord. Il ne
réclame ni les perfs ni une persistance riche.

## Décision

### 1. Starter copié depuis le template (pas de librairie partagée)

Le socle TS est **copié et adapté** depuis `Discord-TemplateBot`, dans le repo du bot.
Pas de lib partagée pour l'instant : un **seul** bot a été réécrit, l'abstraction d'une
couche commune n'est pas **méritée** (règle de 3). La duplication réelle entre bots, si
elle apparaît, sera extraite **plus tard**, sur preuve, par la règle de 3 — pas par
anticipation.

Adaptations au runtime **Bun** vs le template (qui visait Node + pnpm + build `tsc`) :
- **Bun exécute le TypeScript directement** : pas d'étape `tsc` de build pour lancer
  (`bun src/index.ts`). `tsc --noEmit` est **conservé uniquement pour le typecheck**.
- Package manager = **Bun** (`bun install`, lockfile `bun.lock`), plus pnpm.
- Imports **sans extension `.js`** (résolution Bun/`bundler`), à la différence du template
  qui ciblait l'ESM Node avec extensions explicites.
- **Fastify conservé** pour l'API (standard de la flotte ; Elysia reste réservé au
  monitoring `bdf-monitor`). Cohérent avec `bots/_standards/`.

### 2. ACL ciblée domaine (pas de wrapper complet de Discord.js)

Le **domaine de stylisation** (`src/domain/`) ne dépend de **RIEN** : value objects et
fonctions pures, **aucun import de `discord.js`**. C'est là que vivra (en B3) le pipeline
`convertir_texte` réécrit derrière les tests de caractérisation.

Les **adapters Discord** (`src/commands/`, futurs `src/events/`) **traduisent** vers le
domaine : ils extraient les primitives (texte, nom de style) des objets Discord.js, appellent
le domaine pur, et reposent le résultat dans Discord. **Pas de wrapper complet** de Discord.js :
on ne ré-abstrait pas l'intégralité de la lib (cérémonie non méritée). L'ACL est **ciblée** —
elle empêche une seule classe d'erreurs précise : que le modèle Discord (`Member`, `Role`,
`Interaction`) **fuite** dans le domaine.

### 3. Persistance = config fichier versionnée (aucune DB)

Le mapping **rôles→styles** (successeur de `role.json`) reste une **config fichier
versionnée** dans le repo, chargée et validée au démarrage. **Pas de DB**, **pas de projet
Neon** pour le pilote :
- la donnée est petite, lue au boot, modifiée par commit (auditable via git) ;
- une DB serait une dépendance d'infra (provisioning, connexion, migrations) **non méritée**
  par le volume et la fréquence de changement ;
- cohérent avec le contrat monitoring : `/health` doit répondre **sans I/O lourde**.

## Conséquences

- **Pour B3** : le domaine pur s'implémente dans `src/domain/` derrière le harnais de
  caractérisation (porté de `tests/test_characterization.py`). Aucun `import` de `discord.js`
  n'est toléré dans `src/domain/` — c'est l'invariant que l'ACL ciblée protège.
- **Provenance des données centralisée** : une seule couche (chargeur de config + `styles.json`
  / mapping rôles→styles) sait *d'où vient* la donnée de stylisation. Les commandes consomment
  le domaine, jamais les fichiers JSON bruts.
- **Évolution flotte** : si un 2ᵉ bot réécrit duplique ce socle, la règle de 3 déclenchera
  l'extraction d'une lib partagée — décision future, ADR dédié. Le pilote ne la pré-câble pas.
- **Bugs pinnés** ([`docs/caracterisation.md`](../docs/caracterisation.md), § Bugs pinnés) :
  reproduits ou corrigés **explicitement** en B3, jamais par accident — le harnais porté les fige.
- **Coexistence legacy/rewrite** : le `bot.py` Python reste **intact** jusqu'à la bascule (B7).
  Le scaffold TS coexiste à la racine sans toucher au legacy.

## Alternatives écartées

- **Librairie partagée d'emblée** : abstraction non méritée (règle de 3) tant qu'un seul bot
  est réécrit ; c'est précisément ce que le pilote doit trancher sur preuve. Pré-câbler une
  couche commune sur la base d'un seul exemple, c'est de la cérémonie (cf. `ARCHITECTURE.md`,
  mandat « l'architecture empêche, elle ne décore pas »).
- **Wrapper complet de Discord.js** : ré-abstraire toute la lib derrière nos propres types
  multiplie le code sans interdire de classe d'erreurs supplémentaire (Discord.js est déjà
  typé). L'ACL ciblée suffit à protéger l'invariant « pas de Discord dans le domaine ».
- **Persistance en base (Neon)** : provisioning, connexion réseau et migrations pour une donnée
  de quelques dizaines d'entrées modifiée par commit — coût d'infra injustifié, et risque d'I/O
  dans le chemin `/health`. Écarté pour le pilote ; réévaluable si un bot futur a un domaine à
  état riche.
- **Elysia pour l'API** : réservé au monitoring (`bdf-monitor`). Imposer un 2ᵉ framework HTTP à
  la flotte de bots romprait le standard `bots/_standards/` (Fastify). Écarté.
