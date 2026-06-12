# Domaine — Stylisation de pseudo (bounded context)

> Cœur métier de ReNamioos. **Pur** : aucune dépendance à Discord.js, à Fastify ou à
> l'I/O. C'est l'invariant que l'ACL ciblée protège (cf. [ADR-0002](../../docs/decisions/0002-pattern-starter.md)).
> Les adapters (`src/commands/`, futurs `src/events/`) traduisent les interactions Discord
> vers ce domaine et reposent le résultat.

## Statut

**Implémenté en B3, corrigé en B5 (lot B4).** Le pipeline a d'abord été porté à **parité
stricte** avec le `bot.py` legacy (B3), derrière le harnais de caractérisation porté en
`bun:test` (`stylisation.test.ts`). Le lot **B4** (cf.
[ADR-0003](../../docs/decisions/0003-corrections-comportements-pinnes.md)) a ensuite **corrigé**
4 des comportements pinnés ; chaque test du harnais touché porte un commentaire
`ÉCART VOLONTAIRE (B4): …`, les autres restent à parité stricte.

| Fichier | Rôle |
|---|---|
| `styles.ts` | **Provenance des données** : charge `data/styles.json` (tables de glyphes + `conversions`), expose `STYLE_NAMES`, `StyleName`, `STYLES`, `CONVERSIONS`. Successeur versionné de `styles.json` (aucune DB). |
| `stylisation.ts` | Pipeline **pur** : `nettoyerPseudo`, `convertirChiffres`, `mettreMajusculeDebut`, `convertirTexte` (→ `ResultatStylisation`), `tronquerPseudo`. Types `ErreurStylisation` / `ResultatStylisation`. |
| `auto-rename.ts` | **Logique pure de l'auto-rename (B6)** : `rolesAjoutes` (diff d'ensembles), `styleDeclenche` (quel style appliquer suite à un changement de rôles, priorité = ordre du mapping), `styleAvecConsentement` (gate opt-out membre, [ADR-0007](../../docs/decisions/0007-opt-out-membre.md)), type `MappingRoleStyle`. Aucun import discord.js. Voir [ADR-0004](../../docs/decisions/0004-auto-rename.md). |
| `stylisation.test.ts` / `auto-rename.test.ts` | Harnais de caractérisation porté (ÉCARTS B4 marqués) ; suite d'acceptation du domaine auto-rename (ÉCARTS B6 marqués). |
| `data/` | Config fichier versionnée (`styles.json`). **Diverge volontairement** du legacy depuis B4 : `conversions` couvre les 10 chiffres (2→Z, 6→G, 9→G). Le mapping rôles→styles n'est plus ici : sa provenance est le port `MappingStore` (`src/mapping/`, Neon ou fichier ; B8, ADR-0005). |

**Corrections B4 (ADR-0003)** — chacune un ÉCART VOLONTAIRE :
1. `scriptify` officialisé → 9 styles publics (UI/doc).
2. Accents **préservés partout** (`nettoyerPseudo` ne rogne plus que les non-lettres-non-chiffres
   en bord ; les lettres Unicode survivent quelle que soit leur position).
3. Re-styliser un texte déjà stylisé → **refus propre** : `convertirTexte` renvoie un
   `ResultatStylisation` discriminé ; absence de lettre ASCII stylisable → `ok: false`
   (`'rien-a-styliser'`), aucun rendu. Style inconnu → `ok: false` (`'style-inconnu'`).
4. Mapping chiffres **complété** (10 chiffres).

## Langage ubiquitaire (source : `docs/caracterisation.md`)

| Terme | Définition |
|---|---|
| **Style** | Police Unicode nommée (`cursive`, `gothique`, …) ⇒ table `ASCII → glyphe`. Source : `styles.json`. |
| **Conversion (chiffres)** | Substitution leet `chiffre → lettre` (`4 → A`) appliquée avant le style. Depuis B4 : les **10** chiffres. |
| **Nettoyage** | Retrait des caractères **non-lettre-non-chiffre** **aux extrémités** du pseudo (B4 : les lettres Unicode, accents compris, sont préservées). |
| **Capitalisation** | Majuscule sur la **première lettre** rencontrée. |
| **Texte stylisé** | Sortie de `convertirTexte` (cas `ok`) : nettoyé → chiffres convertis → capitalisé → mappé glyphe par glyphe. |
| **Refus propre** | Cas `ok: false` : style inconnu, ou aucune lettre ASCII à styliser (texte vide, symboles, ou déjà stylisé). Pas de rendu. |

## API publique du domaine

```ts
convertirTexte(texte: string, style: StyleName): ResultatStylisation;

type ResultatStylisation =
  | { ok: true; texte: string }
  | { ok: false; erreur: ErreurStylisation };

type ErreurStylisation = 'style-inconnu' | 'rien-a-styliser';
```

Pipeline (cf. `docs/caracterisation.md`, § Pipeline de conversion) :
`[0] style inconnu → erreur ; [1] nettoyer → [2] convertir chiffres → refus si rien à styliser ; [3] capitaliser → [4] mapper le style`.

## Comportements corrigés en B4 (ÉCARTS VOLONTAIRES)

Les bugs pinnés du legacy ont été tranchés en B4 (cf.
[ADR-0003](../../docs/decisions/0003-corrections-comportements-pinnes.md)). **Corrigés** : accents
préservés, non-idempotence destructrice → refus propre, chiffres 2/6/9 mappés, `scriptify`
officialisé. **Tranchés en B6** (couche événements, cf.
[ADR-0004](../../docs/decisions/0004-auto-rename.md)) : auto-rename source = pseudo serveur sinon nom
global (plus `after.name`), détection par **diff d'ensembles** (plus la cardinalité). **Restant**
(non porté, hors périmètre rewrite) : commandes préfixe `!` inexistantes.

Point de vigilance JS/TS : la troncature à **32 code points** se fait via `[...str].slice(0, 32)`
(les glyphes stylisés sont majoritairement hors BMP) — **pas** `str.slice(0, 32)`.

## Provenance des données

Les **tables de glyphes** (`data/styles.json`) restent une **config fichier versionnée**, chargée
et validée au démarrage (cf. [ADR-0002](../../docs/decisions/0002-pattern-starter.md), décision 3).

Le **mapping rôles→styles** de l'auto-rename, lui, n'est **plus** une donnée du domaine ni un
fichier figé : depuis B8 ([ADR-0005](../../docs/decisions/0005-config-auto-rename-neon.md), supersède
ADR-0004) sa **provenance** est le port `MappingStore` (`src/mapping/`) — Neon par serveur en prod,
fichier `auto-rename.json` en dev. Le domaine pur ne connaît que le type `MappingRoleStyle`
(`styleDeclenche` le reçoit déjà ordonné) ; il ignore d'où il vient.
