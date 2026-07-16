# Pseudo d'origine — le port `OriginalNickStore` (bounded context)

> **Responsabilité unique** : savoir _d'où vient_ le pseudo source mémorisé avant un auto-rename
> et le lire / l'écrire / l'oublier, sans que les adapters Discord connaissent la source. Point de
> **provenance centralisée** (mandat `ARCHITECTURE.md`). Introduit pour l'issue
> [#25](https://github.com/BaptisteLeDev/ReNamioos/issues/25) — le **round-trip** de l'auto-rename.
> Étendu par [#38](https://github.com/BaptisteLeDev/ReNamioos/issues/38) : la même ligne porte une
> **échéance** optionnelle (`expiresAt`) pour le **renommage temporaire** (`/rename ... duree:`),
> restauré par le job de balayage (`src/jobs/`).

## Langage ubiquitaire

| Terme                           | Définition                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pseudo d'origine**            | Le pseudo du membre **avant** stylisation, mémorisé pour pouvoir le restaurer.                                                                              |
| **Round-trip**                  | Aller (mémoriser + styliser au gain d'un rôle mappé) puis retour (restaurer au retrait du dernier rôle mappé).                                              |
| **Mémorisation idempotente**    | `rememberIfAbsent` n'écrase **jamais** un original déjà mémorisé : une re-stylisation ne perd pas le vrai pseudo source.                                    |
| **Pose d'échéance** (`rememberWithDeadline`) | Écrit / **rafraîchit** `expiresAt` **même si une ligne existe déjà** (`ON CONFLICT DO UPDATE SET expires_at`), sans toucher le pseudo d'origine. Distinct de `rememberIfAbsent` (idempotent) : un membre déjà sous auto-rename par rôle peut recevoir un `/rename ... duree:` sans que l'échéance soit perdue. Renvoie `true` si une **nouvelle** ligne a été créée. |
| **Oubli**                       | `forget` supprime la ligne après restauration (la donnée n'a plus de raison d'exister).                                                                     |
| **Guild / Membre**              | Clé `(guild_id, member_id)` : un seul pseudo d'origine par membre et par serveur.                                                                           |
| **Mode mémoire / mode Neon**    | Branché par `DATABASE_URL` : absente ⇒ mémoire (dev, éphémère), présente ⇒ Neon (prod, persistant).                                                         |
| **Échéance** (`expiresAt`, #38) | Date d'auto-revert (epoch ms). `NULL`/absente ⇒ revert piloté par la perte du dernier rôle mappé (#25). Présente ⇒ revert temporisé (`/rename ... duree:`). |
| **Ligne due**                   | Ligne dont `expiresAt <= maintenant` : à restaurer par le job de balayage (`listDue`).                                                                      |

## API publique (port `OriginalNickStore`)

```ts
interface OriginalNickStore {
  get(guildId: string, memberId: string): Promise<string | null>;
  rememberIfAbsent(
    guildId: string,
    memberId: string,
    nick: string,
    expiresAt?: number,
  ): Promise<void>; // no-op si déjà présent
  rememberWithDeadline( // pose/rafraîchit expiresAt MÊME si la ligne existe (#38, audit)
    guildId: string,
    memberId: string,
    nick: string,
    expiresAt: number,
  ): Promise<boolean>; // true = nouvelle ligne créée (⇒ l'appelant ne forget() sur échec que ce qu'il a créé)
  forget(guildId: string, memberId: string): Promise<void>; // idempotent
  listDue(maintenant: number): Promise<Array<{ guildId: string; memberId: string; nick: string }>>; // échéances échues (#38)
  listPendingByGuild( // échéances À VENIR d'une guilde, /rename-pending (#46)
    guildId: string,
    maintenant: number,
  ): Promise<Array<{ memberId: string; nick: string; expiresAt: number }>>;
  getPending( // ligne temporaire d'un membre (null si role-only), /rename-cancel (#46)
    guildId: string,
    memberId: string,
  ): Promise<{ nick: string; expiresAt: number } | null>;
}
```

Composition : `creerOriginalNickStore({ databaseUrl, queries? })` (`index.ts`).

## Fichiers et responsabilités

| Fichier           | Rôle                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store.ts`        | Le **port** (interface). Consommateur : événement `guildMemberUpdate` (mémorise au rename, restaure au retrait).                                                                  |
| `neon-store.ts`   | Adapter **Neon** : cache en mémoire **par guild** (`Map` memberId → nick), invalidé (ciblé) à chaque écriture, avec une **génération par guild** empêchant un read en vol de re-peupler le cache après une invalidation (garde anti-race). Reçoit `OriginalNickQueries` par **injection** (testable sans DB). |
| `neon-queries.ts` | Requêtes **drizzle** concrètes (seul fichier qui écrit du SQL contre `auto_rename_original_nicks`). `upsertIfAbsent` en `ON CONFLICT DO NOTHING` (ne pas écraser l'original) ; `upsertWithDeadline` en `ON CONFLICT DO UPDATE SET expires_at` (pose l'échéance sans toucher l'original). |
| `memory-store.ts` | Adapter **mémoire** (dev) : pseudo éphémère, perdu au redémarrage.                                                                                                                |
| `index.ts`        | **Composition** : branche le bon adapter selon `DATABASE_URL`.                                                                                                                    |

La décision pure « faut-il restaurer, et vers quoi ? » vit dans `src/domain/auto-rename.ts`
(`aPerduDernierRoleMappe`) ; la restauration côté Discord passe par `restaurerPseudo`
(`src/commands/styliser.ts`), pendant « retour » du flux partagé `appliquerRename`.

## Provenance des données

- **Neon** (prod) : table `auto_rename_original_nicks(guild_id, member_id, original_nick, expires_at)`,
  PK `(guild_id, member_id)`, **index partiel** sur `expires_at` (`where expires_at is not null`) pour
  un balayage léger (#38). À provisionner comme les autres tables — **aucune migration générée**
  depuis ce repo ; `src/db/schema.ts` ne sert qu'au typage drizzle.
- **Mémoire** (dev) : `Map` par `(guild, membre)`, non persistée.

## Invariants

- **Minimisation D8** : une ligne n'existe **que** tant qu'un membre est stylisé ; `forget` la
  supprime après restauration. La table reste petite (seuls les membres actuellement stylisés).
- **Mémorisation idempotente** : `rememberIfAbsent` ne touche pas un original déjà présent ⇒ une
  re-stylisation (changement de rôle mappé) ne corrompt jamais le vrai pseudo source.
- **Source unique** : `guildMemberUpdate` passe par le port, jamais par la table en direct.
- **Cache invalidé à l'écriture** : après `rememberIfAbsent`/`rememberWithDeadline`/`forget`, le `get`
  suivant de **cette** guild relit la base ; les autres guilds gardent leur cache (invalidation ciblée).
- **Pas de re-peuplement périmé (anti-race)** : un `selectByGuild` en vol capture la **génération** de
  la guild à son démarrage et ne peuple le cache que si elle n'a pas changé pendant l'`await` ; une
  invalidation concurrente empêche donc l'écriture d'un snapshot périmé (le read repart à froid).

## Tests

La logique (cache, invalidation ciblée, idempotence) est testée sur des **fakes injectés**
(`neon-store.test.ts`) et en mémoire (`memory-store.test.ts`). Le round-trip événementiel est testé
dans `src/events/guild-member-update.test.ts` (mémorisation au rename, restauration au retrait du
dernier rôle mappé). `neon-queries.ts` (drizzle) est couvert par le typecheck et l'exécution réelle.
