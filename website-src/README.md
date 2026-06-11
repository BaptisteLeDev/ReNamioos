# ReNamioos — Landing page

Source de la landing page **ReNamioos** (bot identité de la flotte
BotDiscordFactory). Site **Astro statique** qui consomme le design system
[`@bdf/design`](../../../sites/bdf-design).

## Quoi / pourquoi

- **Quoi** : une page unique (`src/pages/index.astro`) présentant les 8 styles
  Unicode, les commandes slash, et l'auto-rename par rôle.
- **Pourquoi `@bdf/design`** : tout le langage visuel (tokens, composants Astro,
  layout) vient du design system partagé. La page ne fait que le **consommer** —
  accent `data-bot="renamioos"` (lavande/lilas, blob pétale). Aucune couleur en
  dur côté site.

## Structure

```
website-src/
├── astro.config.mjs     # outDir → ../website (build committé)
├── package.json         # dépend de @bdf/design en file:
├── tsconfig.json
└── src/
    ├── data/styles.ts   # les 8 styles + aperçus (contenu statique Unicode)
    └── pages/index.astro
```

Le **build statique** est écrit dans [`../website`](../website) (versionné),
destiné à un déploiement Vercel ultérieur (non configuré ici).

## Dépendance au design system

```jsonc
// package.json
"@bdf/design": "file:../../../sites/bdf-design"
```

> **Futur** : quand le remote existera, basculer vers
> `"@bdf/design": "github:BaptisteLeDev/bdf-design#main"` (cf. README de
> `@bdf/design`). Aucun autre changement requis.

Composants `@bdf/design` consommés : `Base`, `Nav`, `Hero`, `CommandCard`,
`CommandGrid`, `CtaBand`, `Footer`, `BlobShape`. Les sections « 8 styles » et
« auto-rename » sont des **sections de contenu locales** stylées uniquement avec
les tokens (pas de nouveau composant : ce ne sont pas des primitives réutilisables).

## Développement

```bash
pnpm install       # outil retenu (voir note ci-dessous)
pnpm run dev        # http://localhost:4321
pnpm run build      # régénère ../website (le build committé)
pnpm run preview    # sert ../website
```

> **Outil — pourquoi pnpm et non bun.** La consigne était : `bun` d'abord,
> fallback `pnpm` puis `npm`. Sur cette machine (Windows natif + dossier sous
> OneDrive), `bun install` se bloque indéfiniment à la résolution avec la
> dépendance `@bdf/design` en `file:` relative traversant trois niveaux hors du
> worktree. `pnpm 10.x` installe la même arborescence en ~10 s et produit un
> build vert : c'est donc l'outil retenu, et `pnpm-lock.yaml` est committé pour
> figer les versions. `npm` reste un fallback compatible (mêmes scripts).
> Le playground `@bdf/design`, lui, reste en `bun` (sa dépendance `file:..` est à
> un seul niveau, ce qui n'a pas posé de problème).

## Contenu & fidélité

- Les **aperçus Unicode** dans `src/data/styles.ts` sont du contenu pré-converti :
  le site n'embarque PAS l'algorithme de conversion (qui reste au bot).
- Le 9e style interne **`scriptify`** (non documenté publiquement) n'est pas exposé.
- L'**URL d'invitation Discord** est un placeholder (`INVITE_URL` dans
  `index.astro`) : à remplacer par l'OAuth2 réel une fois l'application publiée.
