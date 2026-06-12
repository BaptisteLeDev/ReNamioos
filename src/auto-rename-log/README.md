# Journal d'auto-rename — le port `AutoRenameLogStore` (bounded context)

> **Responsabilité unique** : savoir *d'où vient* le journal des derniers auto-renames d'une
> guilde (succès / échec) et le lire / l'écrire, sans que les adapters Discord/HTTP connaissent
> la source. Point de **provenance centralisée** (mandat `ARCHITECTURE.md`). Introduit pour
> l'issue [#28](https://github.com/BaptisteLeDev/ReNamioos/issues/28).

## Langage ubiquitaire

| Terme | Définition |
|---|---|
| **Événement** (`AutoRenameLogEntry`) | Une tentative d'auto-rename effective : `(guild, membre, style, issue, détail, instant)`. |
| **Issue** (`AutoRenameOutcome`) | `succes` (pseudo appliqué) ou `echec` (hiérarchie, permission, refus propre). |
| **Détail** | Champ libre : le pseudo appliqué (succès) ou le message d'échec (échec). Un seul champ, pas une colonne par cas (minimisation D8). |
| **Ring-buffer** | On ne garde que les `CAPACITE_JOURNAL_PAR_GUILD` (= 50) événements les plus récents **par guilde**. |
| **Échecs du jour** | Compteur en mémoire dérivé des `record`, remis à zéro au changement de jour. Alimente `autoRenameFailuresToday` de `/stats`. |
| **Mode mémoire / mode Neon** | Branché par `DATABASE_URL` : absente ⇒ mémoire (dev, éphémère), présente ⇒ Neon (prod, persistant). |

## API publique (port `AutoRenameLogStore`)

```ts
interface AutoRenameLogStore {
  record(entry: AutoRenameLogEntry): Promise<void>;        // alimenté par guildMemberUpdate
  recent(guildId: string, limite: number): Promise<AutoRenameLogEntry[]>; // /auto-rename log
  failuresToday(): number;                                  // SYNCHRONE — alimente /stats
}
```

Composition : `creerAutoRenameLogStore({ databaseUrl, queries? })` (`index.ts`).

## Fichiers et responsabilités

| Fichier | Rôle |
|---|---|
| `store.ts` | Le **port** (interface). Consommateurs : événement `guildMemberUpdate` (record), commande `/auto-rename log` (recent), `BotClient.getStats` (failuresToday). |
| `compteur-echecs.ts` | Logique **partagée** du compteur d'échecs du jour (rollover à minuit). Un seul endroit décide « est-ce encore aujourd'hui ? » ⇒ identique pour les deux adapters. |
| `neon-store.ts` | Adapter **Neon** : `record` insère puis purge au-delà de la capacité (ring-buffer côté DB) ; compteur du jour en mémoire. Reçoit `AutoRenameLogQueries` par **injection** (testable sans DB). |
| `neon-queries.ts` | Requêtes **drizzle** concrètes (seul fichier qui écrit du SQL contre `auto_rename_log`). |
| `memory-store.ts` | Adapter **mémoire** (dev) : ring-buffer en `Map` par guilde, éphémère. |
| `index.ts` | **Composition** : branche le bon adapter selon `DATABASE_URL` ; expose `CAPACITE_JOURNAL_PAR_GUILD`. |

La logique de ring-buffer pur (`tronquerJournal`) et de dérivation (`compterEchecsDepuis`)
vit dans `src/domain/auto-rename-log.ts` (sans dépendance Discord ni Neon).

## Provenance des données

- **Neon** (prod) : table `auto_rename_log(id, guild_id, member_id, style, outcome, detail, at)`,
  index `(guild_id, at desc)`. À provisionner comme les autres tables — **aucune migration générée**
  depuis ce repo ; `src/db/schema.ts` ne sert qu'au typage drizzle.
- **Mémoire** (dev) : `Map` par guilde, non persistée.

## Invariants

- **Minimisation D8** : taille bornée à `CAPACITE_JOURNAL_PAR_GUILD * nombre de guildes` (purge des
  plus anciens à chaque insert). Jamais de croissance illimitée.
- **`failuresToday()` synchrone et sans I/O** : le contrat `/stats` impose un `getStats()` rapide
  (cf. `api/contract.test.ts`). Le compteur est en mémoire, pas un round-trip Postgres.
- **Source unique** : `guildMemberUpdate` et `/auto-rename log` passent par le port, jamais par la table.
- **On ne journalise que les tentatives effectives** : aucun rôle mappé gagné ou membre opt-out
  ⇒ pas une tentative ⇒ rien dans le journal.

## Tests

Le ring-buffer et la dérivation du compteur sont testés purs (`src/domain/auto-rename-log.test.ts`).
Les adapters mémoire et Neon sont testés sur des **fakes injectés** (`*-store.test.ts`). Le gate
événementiel (`src/events/guild-member-update.test.ts`) et la commande
(`src/commands/auto-rename.test.ts`) utilisent un `AutoRenameLogStore` fake. `neon-queries.ts`
(drizzle) est couvert par le typecheck et l'exécution réelle (pas de DB en test).
