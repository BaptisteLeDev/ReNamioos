# Domaine — Stylisation de pseudo (bounded context)

> Cœur métier de ReNamioos. **Pur** : aucune dépendance à Discord.js, à Fastify ou à
> l'I/O. C'est l'invariant que l'ACL ciblée protège (cf. [ADR-0002](../../decisions/0002-pattern-starter.md)).
> Les adapters (`src/commands/`, futurs `src/events/`) traduisent les interactions Discord
> vers ce domaine et reposent le résultat.

## Statut

**Vide à l'issue de B2** (scaffold). L'implémentation est la tâche de **B3** : porter le
pipeline `convertir_texte` derrière le harnais de caractérisation
(`worktrees/renamioos-characterization/tests/test_characterization.py`).

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
