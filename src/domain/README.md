# Domaine — Stylisation de pseudo (bounded context)

> Cœur métier de ReNamioos. **Pur** : aucune dépendance à Discord.js, à Fastify ou à
> l'I/O. C'est l'invariant que l'ACL ciblée protège (cf. [ADR-0002](../../decisions/0002-pattern-starter.md)).
> Les adapters (`src/commands/`, futurs `src/events/`) traduisent les interactions Discord
> vers ce domaine et reposent le résultat.

## Statut

**Implémenté en B3.** Le pipeline `convertirTexte` est porté à **parité stricte** avec le
`bot.py` legacy, derrière le harnais de caractérisation porté en `bun:test`
(`stylisation.test.ts`, 63 tests, mêmes littéraux Unicode que la version Python).

| Fichier | Rôle |
|---|---|
| `styles.ts` | **Provenance des données** : charge `data/styles.json` (tables de glyphes + `conversions`) et `data/roles.json`, expose `STYLE_NAMES`, `StyleName`, `STYLES`, `CONVERSIONS`, `ROLE_CONFIG`. Successeur versionné de `styles.json`/`role.json` (aucune DB). |
| `stylisation.ts` | Pipeline **pur** : `nettoyerPseudo`, `convertirChiffres`, `mettreMajusculeDebut`, `convertirTexte`, `tronquerPseudo`. |
| `stylisation.test.ts` | Harnais de caractérisation porté (parité stricte). |
| `data/` | Config fichier versionnée (copie bit-pour-bit de `styles.json`/`role.json` racine, vérifiée par SHA256). |

**Décision B3 (actée) : les 7 bugs pinnés sont REPRODUITS tels quels**, pas corrigés —
les corrections sont des décisions B4/B5 assumées. Preuve de parité croisée : 960 sorties
(`out` + `trunc`) générées sur 96 entrées × 10 styles (9 + style inconnu), diffées contre
`convertir_texte` du `bot.py` réel → **diff vide**.

## Langage ubiquitaire (source : `docs/caracterisation.md`)

| Terme | Définition |
|---|---|
| **Style** | Police Unicode nommée (`cursive`, `gothique`, …) ⇒ table `ASCII → glyphe`. Source : `styles.json`. |
| **Conversion (chiffres)** | Substitution leet `chiffre → lettre` (`4 → A`) appliquée avant le style. |
| **Nettoyage** | Retrait des caractères non `[a-zA-Z0-9]` **aux extrémités** du pseudo. |
| **Capitalisation** | Majuscule sur la **première lettre** rencontrée. |
| **Texte stylisé** | Sortie de `convertir_texte` : nettoyé → chiffres convertis → capitalisé → mappé glyphe par glyphe. |

## API publique cible du domaine (à implémenter en B3)

Fonction pure attendue (signature indicative, à figer par les tests portés) :

```ts
convertirTexte(texte: string, style: StyleName): string;
```

Pipeline (cf. `docs/caracterisation.md`, § Pipeline de conversion) :
`[0] court-circuit style inconnu → [1] nettoyer → [2] convertir chiffres → [3] capitaliser → [4] mapper le style`.

## Invariants pinnés à reproduire (décision explicite B3)

Les **bugs pinnés** du legacy (non-idempotence destructrice, accents perdus en bord, chiffres
2/6/9 non convertis, `scriptify` fantôme dans l'UI) sont figés par le harnais. B3 décide
**explicitement** de les reproduire ou de les corriger — jamais par accident.

Point de vigilance JS/TS : la troncature à **32 code points** se fait via `[...str].slice(0, 32)`
(les glyphes stylisés sont majoritairement hors BMP) — **pas** `str.slice(0, 32)`.

## Provenance des données

Le mapping rôles→styles et les tables de glyphes sont une **config fichier versionnée**
(successeurs de `role.json` / `styles.json`), chargée et validée au démarrage — **aucune DB**
(cf. [ADR-0002](../../decisions/0002-pattern-starter.md), décision 3).
