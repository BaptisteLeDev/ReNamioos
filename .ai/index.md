# Index agent — ReNamioos

> Base de connaissance MACHINE. Cet index POINTE vers la prose humaine (racine, `docs/`,
> `decisions/`, READMEs de domaine) et vers les stores machine (`context/`, `remember/`,
> `design-system/`). Il ne recopie aucun contenu : suivre les liens.

## Prose humaine (vérité)

| Ressource | Hook |
|---|---|
| [`../README.md`](../README.md) | Quoi/pourquoi, install Discord, commandes, modes auto-rename (fichier/Neon), structure projet. |
| [`../ARCHITECTURE.md`](../docs/ARCHITECTURE.md) | Couches (domaine pur, mapping, adapters Discord, API), ACL ciblée, flux de données, contrat monitoring, bootstrap API-d'abord, déploiement Docker/CI/CD. |
| [`../CONFIG.md`](../CONFIG.md) | Variables d'environnement (référence courte). |
| [`../EXEMPLES.md`](../EXEMPLES.md) | Exemples d'usage des commandes/styles. |
| [`../src/domain/README.md`](../src/domain/README.md) | Bounded context **stylisation** : langage ubiquitaire, API pure (`convertirTexte`), invariants, écarts B4 vs legacy. |
| [`../src/mapping/README.md`](../src/mapping/README.md) | Bounded context **provenance auto-rename** : port `MappingStore`, adapters Neon/fichier/composite, invariants cache/fallback. |

## Décisions (ADR)

| ADR | Hook |
|---|---|
| [`../decisions/0001-langage-cible-reecriture.md`](../docs/decisions/0001-langage-cible-reecriture.md) | Choix Bun/TypeScript pour la réécriture du pilote (legacy Python). |
| [`../decisions/0002-pattern-starter.md`](../docs/decisions/0002-pattern-starter.md) | Pattern du bot pilote : domaine pur, ACL ciblée, config fichier versionnée. |
| [`../decisions/0003-corrections-comportements-pinnes.md`](../docs/decisions/0003-corrections-comportements-pinnes.md) | Lot B4 : 4 corrections vs comportements pinnés du legacy (accents, refus propre, chiffres, scriptify). |
| [`../decisions/0004-auto-rename.md`](../docs/decisions/0004-auto-rename.md) | Auto-rename par rôles (config fichier). **Superseded par 0005.** |
| [`../decisions/0005-config-auto-rename-neon.md`](../docs/decisions/0005-config-auto-rename-neon.md) | Config auto-rename par serveur en Neon (commande admin, cache, fallback fichier). |
| ADR-0006 (branche `fix/security-v1`) | Durcissement API HTTP : auth Bearer `/stats`, CORS allowlist, rate limit, borne `/convert`. Pas encore sur `main`. |

## Stores machine

| Store | Hook |
|---|---|
| [`context/stack.md`](context/stack.md) | Runtime Bun, libs résolues (versions lockfile), DB Neon, ports, outillage test/CI. |
| [`context/code-standards.md`](context/code-standards.md) | Pointe vers `tsconfig.json` (strict), conventions de couche observées, pas de lint/format dédié. |
| [`remember/patterns.md`](remember/patterns.md) | Patterns réellement appliqués : ports/adapters, ACL ciblée, value object résultat, composite store, bootstrap API-d'abord. |
| [`remember/anti-dup.md`](remember/anti-dup.md) | Abstractions de centralisation existantes + dette de duplication connue (durcissement API monitoring à centraliser, Template v2). |
| [`remember/progress.md`](remember/progress.md) | État au 2026-06-11 : branches feature ouvertes, PR en cours, reste à faire. |
| [`design-system/ui-rules.md`](design-system/ui-rules.md) | Landing Astro (`feat/website`) consommant `@bdf/design` partagé. Pointe vers le design-system, ne recopie pas les tokens. |
