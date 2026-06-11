# UI rules — ReNamioos (landing)

> ReNamioos a une **landing page** (site statique Astro) qui consomme le design-system **partagé**
> de la flotte, `@bdf/design`. Ce store POINTE vers ce design-system, il ne recopie **aucun token**.

## Localisation

- **Branche** : `feat/website` (PR [#21](https://github.com/BaptisteLeDev/ReNamioos/pull/21) → `main`).
  Pas encore sur `main`.
- **Source** : `website-src/` (Astro 5, package `@renamioos/website`).
  - `website-src/src/pages/index.astro` : la page.
  - `website-src/scripts/gen-styles.mjs` : génère les aperçus de styles depuis `src/domain/data/styles.json`
    (single source des glyphes, pas de table dupliquée dans le site).
  - `website-src/package.json` : dépend de `@bdf/design` (`file:../../../sites/bdf-design`) et d'Astro.
- **Build statique** : sorti dans `website/` (servi tel quel).

## Design-system partagé (source des tokens)

- **`@bdf/design`** = design-system de la flotte Discord Bot Factory, repo/dossier `sites/bdf-design`
  (chemin relatif depuis le bot : `../../../sites/bdf-design`). Les tokens (couleurs, typographie,
  espacements), composants et règles UI vivent **là-bas**, pas ici.
- Règle anti-dup : ne pas recopier les tokens de `bdf-design` dans ReNamioos. Toute évolution de
  thème/tokens se fait dans `bdf-design` ; le site ReNamioos re-synchronise son build dessus
  (cf. commit `build(website): resynchronise le build sur bdf-design b9306d2`).

## À consulter pour les tokens/règles réels

- Le design-system `sites/bdf-design` (hors de ce repo) : `package.json` `@bdf/design`, ses tokens
  et composants exportés. C'est la vérité UI. Ce fichier n'est qu'un pointeur.
- Accessibilité déjà traitée côté landing (commit `fix(website): accessibilité du hero, libellé
  /styles et tokens d'espacement`).
