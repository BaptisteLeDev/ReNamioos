# Consentement membre — le port `OptOutStore` (bounded context)

> **Responsabilité unique** : savoir *d'où vient* le consentement d'un membre à l'auto-rename
> (a-t-il refusé ?) et le lire / l'écrire, sans que les adapters Discord connaissent la source.
> Point de **provenance centralisée** du mandat `ARCHITECTURE.md`. Introduit pour l'issue
> [#27](https://github.com/BaptisteLeDev/ReNamioos/issues/27)
> ([ADR-0007](../../decisions/0007-opt-out-membre.md)).

## Langage ubiquitaire

| Terme | Définition |
|---|---|
| **Opt-out** | Le membre **refuse** l'auto-rename sur lui, pour ce serveur (`/renamioos opt-out`). |
| **Opt-in** | État **par défaut** : l'auto-rename s'applique. `/renamioos opt-in` annule un opt-out. |
| **Consentement** | Régle pure du domaine (`styleAvecConsentement`) : opt-out ⇒ aucun rename, quel que soit le style déclenché par les rôles. |
| **Guild / Membre** | Clé de partition `(guild_id, member_id)` : le consentement est **par serveur**. |
| **Mode mémoire / mode Neon** | Branché par `DATABASE_URL` : absente ⇒ mémoire (dev, éphémère), présente ⇒ Neon (prod, persistant). |

## API publique (port `OptOutStore`)

```ts
interface OptOutStore {
  isOptOut(guildId: string, memberId: string): Promise<boolean>;
  optOut(guildId: string, memberId: string): Promise<void>; // idempotent
  optIn(guildId: string, memberId: string): Promise<void>;  // idempotent, supprime la ligne
}
```

Composition : `creerOptOutStore({ databaseUrl, queries? })` (`index.ts`).

## Fichiers et responsabilités

| Fichier | Rôle |
|---|---|
| `store.ts` | Le **port** (interface). Consommateurs : commande `/renamioos`, événement `guildMemberUpdate`. |
| `neon-store.ts` | Adapter **Neon** : cache en mémoire **par guild** (ensemble des `memberId` opt-out), invalidé (ciblé) à chaque écriture. Reçoit `OptOutQueries` par **injection** (testable sans DB). |
| `neon-queries.ts` | Requêtes **drizzle** concrètes (seul fichier qui écrit du SQL contre `auto_rename_optouts`). `insert` en `ON CONFLICT DO NOTHING` (idempotent). |
| `memory-store.ts` | Adapter **mémoire** (dev) : consentement éphémère, perdu au redémarrage. Pas de fichier source (donnée d'exécution, pas de config versionnée). |
| `index.ts` | **Composition** : branche le bon adapter selon `DATABASE_URL`. |

## Provenance des données

- **Neon** (prod) : table `auto_rename_optouts(guild_id, member_id)`, PK `(guild_id, member_id)`.
  À provisionner comme les autres tables — **aucune migration générée** depuis ce repo ;
  `src/db/schema.ts` ne sert qu'au typage drizzle.
- **Mémoire** (dev) : `Map` par guild, non persistée.

## Invariants

- **Minimisation D8** : une ligne n'existe **que** pour un membre opt-out (le défaut = consentement =
  absence de ligne) ; `optIn` **supprime** la ligne. La table reste minuscule (seuls les refus, rares).
- **Source unique** : `/renamioos` et `guildMemberUpdate` passent par le port, jamais par la table en direct.
- **Cache invalidé à l'écriture** : après `optOut`/`optIn`, le `isOptOut` suivant de **cette** guild relit
  la base ; les autres guilds gardent leur cache (invalidation ciblée).
- **Lecture opt-out seulement si un style est déclenché** : `guildMemberUpdate` ne consulte le
  consentement qu'après qu'un rôle mappé a déclenché un style (pas de round-trip pour rien).
- **Domaine pur intact** : la régle de consentement vit dans `src/domain/auto-rename.ts`
  (`styleAvecConsentement`) ; ce contexte ne fournit que le booléen opt-out.

## Tests

La logique (cache, invalidation ciblée) est testée sur des **fakes injectés** (`neon-store.test.ts`).
La commande (`src/commands/renamioos.test.ts`) et le gate événementiel
(`src/events/guild-member-update.test.ts`) sont testés avec un `OptOutStore` fake. `neon-queries.ts`
(drizzle) est couvert par le typecheck et l'exécution réelle (pas de DB en test).
