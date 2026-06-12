# ADR-0007 — Opt-out membre de l'auto-rename

- **Statut** : accepté · **Date** : 2026-06-12
- **Contexte amont** : issue [#27](https://github.com/BaptisteLeDev/ReNamioos/issues/27),
  [ADR-0004](0004-auto-rename.md) (logique pure auto-rename), [ADR-0005](0005-config-auto-rename-neon.md)
  (config par serveur en Neon, port `MappingStore`), `DECISIONS.md` D8 (minimisation Neon).

## Contexte

L'auto-rename ([ADR-0004](0004-auto-rename.md)) renomme un membre dès qu'il gagne un rôle mappé, **sans
aucun choix du membre concerné**. Certains membres ne veulent pas voir leur pseudo stylisé
automatiquement. Il manque un mécanisme de **consentement individuel**.

## Décisions

### 1. Consentement par membre et par serveur, défaut = opt-in

Chaque membre peut **refuser** (`opt-out`) ou **réactiver** (`opt-in`) l'auto-rename **sur lui**, **par
serveur** (un membre peut être opt-out sur un serveur, pas sur un autre). Le défaut reste l'auto-rename
actif (opt-in) : aucune régression pour l'existant.

### 2. Régle de consentement PURE dans le domaine

`styleAvecConsentement(styleDeclenché, estOptOut)` (`src/domain/auto-rename.ts`) : `null` si le membre
est opt-out, sinon le style déclenché. Le domaine reste pur (aucune I/O) ; l'événement
`guildMemberUpdate` compose `styleDeclenche` puis cette régle **avant** tout edit de pseudo. Lecture du
consentement **uniquement** si un style est déjà déclenché (pas de round-trip Postgres pour rien).

### 3. Port `OptOutStore` + adapters (provenance unique)

Une **seule** abstraction sait d'où vient le consentement : le port `OptOutStore`
(`src/optout/store.ts`) — `isOptOut`, `optOut`, `optIn`. Deux adapters, branchés par `DATABASE_URL`
(comme `MappingStore`) :

- **`NeonOptOutStore`** : drizzle + **cache par guild** (ensemble des `memberId` opt-out), **invalidé
  ciblé** à chaque écriture. Requêtes **injectables** (`OptOutQueries`, SQL dans `neon-queries.ts`).
- **`MemoryOptOutStore`** : mode dev (éphémère). Pas de fichier source : le consentement est une donnée
  d'exécution, pas une config versionnée (différence avec `FileMappingStore`).

### 4. Table minimale, minimisation D8

```sql
auto_rename_optouts(
  guild_id   text,
  member_id  text,
  PK (guild_id, member_id)
)
```

Une ligne **n'existe que** pour un membre opt-out (défaut = consentement = **absence de ligne**) ;
`opt-in` **supprime** la ligne. La table reste minuscule (seuls les refus, rares), conforme à la
politique de minimisation du plan gratuit Neon (D8). `insert` en `ON CONFLICT DO NOTHING`
(opt-out idempotent). **Aucune migration générée** depuis ce repo ; `src/db/schema.ts` reflète le DDL
pour le typage drizzle (à provisionner sur Neon comme les autres tables).

### 5. Commande `/renamioos` (membre, aucune permission)

Adapter membre (`src/commands/renamioos.ts`), **sans `default_member_permissions`** (visible par tous,
contrairement à `/auto-rename` admin). Réponses **éphémères**. Refus propre hors serveur. Sous-commandes :

- **`opt-out`** : enregistre le refus pour `(guildId, user.id)`.
- **`opt-in`** : retire le refus (réactive l'auto-rename).

## Conséquences

- **Domaine pur préservé** : seule une régle pure (`styleAvecConsentement`) s'ajoute ; aucune fuite
  d'I/O dans le domaine.
- **Provenance unique renforcée** : `/renamioos` et `guildMemberUpdate` lisent le même port. Changer la
  source = un seul point (`src/optout/index.ts` + l'adapter).
- **Chemin chaud protégé** : cache par guild (invalidé à l'écriture) ; le consentement n'est lu qu'après
  qu'un style est déclenché.
- **Pas de DB en test** : cache, invalidation, commande et gate événementiel testés sur des **fakes**.

## Alternatives écartées

- **Réutiliser `auto_rename_mappings`.** Écarté : agrégat différent (config admin par rôle vs
  consentement membre). Mélanger les deux casserait les invariants de chaque port.
- **Stocker un booléen `opted_in` par membre.** Écarté : stockerait une ligne pour **chaque** membre
  (viole la minimisation D8). L'absence de ligne = opt-in suffit.
- **Opt-out global (tous serveurs).** Écarté : la config auto-rename est déjà par serveur (ADR-0005) ;
  le consentement suit la même granularité.
