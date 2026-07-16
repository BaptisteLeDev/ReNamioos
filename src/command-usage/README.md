# Suivi d'usage des commandes — le port `CommandUsageStore` (bounded context)

> **Responsabilité unique** : savoir _d'où vient_ le compte de commandes exécutées par jour
> et le lire / l'écrire, sans que les adapters Discord/HTTP connaissent la source. Point de
> **provenance centralisée** (mandat `ARCHITECTURE.md`). Introduit pour l'issue
> [#27](https://github.com/BaptisteLeDev/ReNamioos/issues/27) : exposer `commandsDaily` dans `/stats`.

## Langage ubiquitaire

| Terme                                      | Définition                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Compte journalier** (`CompteJournalier`) | `(day, count)` : le nombre de commandes exécutées un jour UTC donné. `day` au format `"AAAA-MM-JJ"`.                                  |
| **Jour UTC**                               | Clé de regroupement : `toISOString().slice(0,10)` de l'instant d'exécution. Pas de fuseau local (déterministe).                       |
| **Fenêtre `commandsDaily`**                | Les `FENETRE_COMMANDS_DAILY_JOURS` (= 30) derniers jours, **ascendant** (du plus ancien au plus récent). `[]` si rien.                |
| **Cache journalier**                       | `Map<jour, count>` en mémoire, hydratée au boot puis incrémentée à chaque commande. Permet la lecture synchrone (invariant `/stats`). |
| **Mode mémoire / mode Neon**               | Branché par `DATABASE_URL` : absente ⇒ mémoire (dev, éphémère), présente ⇒ Neon (prod, persistant).                                   |

## API publique (port `CommandUsageStore`)

```ts
interface CommandUsageStore {
  load(): Promise<void>; // hydrate le cache au boot (no-op en mémoire)
  record(): Promise<void>; // alimenté par le dispatch d'interaction (client.ts)
  commandsDaily(): CompteJournalier[]; // SYNCHRONE — alimente /stats (30j, ascendant)
}
```

Composition : `creerCommandUsageStore({ databaseUrl, queries? })` (`index.ts`).

## Fichiers et responsabilités

| Fichier               | Rôle                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store.ts`            | Le **port** (interface). Consommateurs : dispatch `handleInteraction` (record), `BotClient.getStats` (commandsDaily), bootstrap (load).                                                       |
| `cache-journalier.ts` | Logique **partagée** du cache mémoire `Map<jour, count>` (incrément du jour courant, hydratation, série). Délègue la fenêtre/tri à `agregerCommandsDaily`. Identique pour les deux adapters.  |
| `neon-store.ts`       | Adapter **Neon** : `load` hydrate le cache (1 round-trip au boot) ; `record` upsert `+1` en DB **et** incrémente le cache. Reçoit `CommandUsageQueries` par **injection** (testable sans DB). |
| `neon-queries.ts`     | Requêtes **drizzle** concrètes (seul fichier qui écrit du SQL contre `command_daily`).                                                                                                        |
| `memory-store.ts`     | Adapter **mémoire** (dev) : `load` no-op, cache éphémère.                                                                                                                                     |
| `index.ts`            | **Composition** : branche le bon adapter selon `DATABASE_URL`.                                                                                                                                |

La logique pure (`agregerCommandsDaily`, `cleJourUtc`, `FENETRE_COMMANDS_DAILY_JOURS`) vit dans
`src/domain/command-usage.ts` (sans dépendance Discord ni Neon).

## Provenance des données

- **Neon** (prod) : table `command_daily(day date primary key, count integer not null default 0)`.
  Upsert `+1` par jour. À provisionner comme les autres tables — **aucune migration générée** depuis
  ce repo ; `src/db/schema.ts` ne sert qu'au typage drizzle.
- **Mémoire** (dev) : `Map<jour, count>`, non persistée.

## Invariants

- **`commandsDaily()` synchrone et sans I/O** : le contrat `/stats` impose un `getStats()` rapide
  (cf. `api/contract.test.ts`). La série est lue depuis le **cache mémoire**, hydraté une fois au boot
  (`load`), jamais un round-trip Postgres par requête `/stats`.
- **Minimisation D8** : `command_daily` croît d'**une ligne par jour** (agrégat, jamais par commande
  ni par membre). Table négligeable, pas de purge nécessaire.
- **Fenêtre & forme du contrat** : exactement 30 jours glissants UTC, ascendant, `[]` si rien. Un jour
  sans commande n'apparaît pas (pas de padding à zéro) — le consommateur comble à l'affichage.
- **Source unique** : le dispatch et `/stats` passent par le port, jamais par la table directement.

## Tests

L'agrégation (fenêtre, tri, cas vide/multi/>30j) est testée pure (`src/domain/command-usage.test.ts`).
Les adapters mémoire et Neon sont testés sur des **fakes injectés** (`*-store.test.ts`), y compris
l'hydratation du cache et la lecture synchrone. La présence du champ `commandsDaily` dans `/stats` est
pinnée par `src/api/contract.test.ts`. `neon-queries.ts` (drizzle) est couvert par le typecheck et
l'exécution réelle (pas de DB en test).
