# ADR-0005 — Config auto-rename par serveur en Neon (lot B8)

- **Statut** : accepté · **Date** : 2026-06-06
- **Supersede** : [ADR-0004](0004-auto-rename.md) (config fichier `auto-rename.json`), **partiellement** :
  la décision n°3 d'ADR-0004 (config FICHIER `roleId → styleName`, validée zod au boot) est
  remplacée. Les décisions n°1 (source = pseudo serveur sinon nom global) et n°2 (détection par
  diff d'ensembles, priorité = ordre) restent **en vigueur** : le domaine pur de l'auto-rename
  (`src/domain/auto-rename.ts`) ne change pas.
- **Contexte amont** : `DECISIONS.md` D8 (workspace BotDiscordFactory, session 2026-06-06),
  issue [#19](https://github.com/BaptisteLeDev/ReNamioos/issues/19) (épic B8),
  [ADR-0002](0002-pattern-starter.md) (« config fichier, aucune DB » — écarté ici pour ce cas),
  pattern Neon de Moodioos (`bots/Moodioos/src/db/`).

## Contexte

ADR-0004 a posé la config auto-rename comme **fichier versionné** (`auto-rename.json`,
`roleId → styleName`), chargé et validé au boot. Cette forme a deux limites de fond, révélées par
le besoin produit :

1. **Mono-serveur de fait.** Le fichier est global : un seul mapping pour toutes les guilds. Or le
   bot est multi-serveur ; chaque serveur a ses propres rôles (IDs distincts) et veut sa propre
   config.
2. **Non modifiable depuis Discord.** Changer un mapping exige d'éditer un fichier, de committer et
   de **redéployer**. Un admin de serveur ne peut rien configurer lui-même.

**Décision produit de Baptiste (2026-06-06, `DECISIONS.md` D8)** : la config auto-rename doit être
**par serveur** et **modifiable depuis Discord** (sélecteur de rôle natif + choix parmi les styles
du bot). ReNamioos devient un **bot persistant** au sens du standard secrets (1 projet Neon dédié,
`square-frost-15330405`). La table de config est minuscule et persistante (c'est de la **config**,
pas de la donnée d'activité : **aucun TTL**, conforme à la politique de minimisation D8).

## Décisions

### 1. Persistance Neon, une table par serveur (supersede ADR-0004 #3)

La config vit dans une table Postgres Neon :

```sql
auto_rename_mappings(
  guild_id    text,
  role_id     text,
  style_name  text,
  updated_at  timestamptz default now(),
  PK (guild_id, role_id)
)
```

- **`guild_id`** partitionne par serveur (multi-guild par construction).
- **PK `(guild_id, role_id)`** : un rôle ⇒ un style (le sens métier d'ADR-0004 #3 est conservé),
  par serveur. L'upsert sur la PK rend `add` idempotent.
- **`updated_at`** sert l'**ordre = priorité** (cf. décision 4) et la traçabilité. Pas de TTL :
  config persistante.
- La table est **déjà provisionnée** sur Neon. Le repo ne génère **aucune migration** vers Neon ;
  `src/db/schema.ts` reflète le DDL pour le typage drizzle uniquement.

### 2. Mode optionnel : Neon si `DATABASE_URL`, sinon fichier (dev)

`DATABASE_URL` est **optionnelle** (zod, `src/config.ts`). Deux modes :

- **Sans `DATABASE_URL`** (dev) : mode **fichier** seul. `auto-rename.json` reste lu et validé au
  boot ; l'écriture (`/auto-rename add|remove`) est **refusée** (le fichier dev s'édite à la main).
  Aucune connexion Postgres n'est ouverte (init paresseuse du pool, `src/db/client.ts`).
- **Avec `DATABASE_URL`** (prod / Neon) : mode **Neon**. La config est par serveur, modifiable
  depuis Discord.

### 3. Port `MappingStore` + adapters (provenance unique)

Une **seule** abstraction sait d'où vient la config rôle→style : le port `MappingStore`
(`src/mapping/store.ts`) — `styleForRole`, `add`, `remove`, `list(guildId)`. C'est le successeur du
chargeur fichier comme **point de provenance unique** (mandat `ARCHITECTURE.md`). Deux adapters :

- **`NeonMappingStore`** (`src/mapping/neon-store.ts`) : drizzle + **cache en mémoire par guild**,
  **invalidé de façon ciblée à chaque écriture** (add/remove). Le cache évite un round-trip Postgres
  dans le chemin chaud (`guildMemberUpdate`, appelé à chaque changement de rôle). Les fonctions de
  requête sont **injectables** (`MappingQueries`) : le SQL vit dans `neon-queries.ts`, le cache se
  teste sans vraie DB (`neon-store.test.ts`).
- **`FileMappingStore`** (`src/mapping/file-store.ts`) : enrobe `auto-rename.json` (mode dev,
  lecture seule).

Les adapters Discord (commande `/auto-rename`, événement `guildMemberUpdate`, `/aide`) consomment le
**port**, jamais la source brute. Changer la source = changer l'adapter, rien d'autre.

### 4. Priorité = ordre d'ajout (préserve la sémantique ADR-0004)

ADR-0004 #3 encodait la priorité par l'**ordre des clés du fichier**. En Neon, l'équivalent est
l'**ordre d'ajout** : `selectByGuild` ordonne par `updated_at` croissant. Le rôle mappé en premier
l'emporte en cas de gains multiples. La sémantique du domaine pur (`styleDeclenche` parcourt le
mapping ordonné) est **inchangée**.

### 5. Commande `/auto-rename` (admin ManageGuild)

Adapter d'administration (`src/commands/auto-rename.ts`), permission **ManageGuild**
(`default_member_permissions` + revalidation dans `execute`, défense en profondeur ; refus propre
**ephemeral** sinon, et hors serveur). Sous-commandes :

- **`add <role> <style>`** : option **ROLE native** (sélecteur Discord) + option **style** avec les
  **9 choix natifs** dérivés de `STYLE_NAMES` (domaine).
- **`remove <role>`** : retire le mapping.
- **`list`** : mappings de la guild, **aperçu de style** dérivé du domaine (`apercuStyle`).

### 6. Fallback LECTURE fichier pendant la transition (transitoire)

Tant qu'une guild n'a **aucun** mapping en base, le mode Neon lit `auto-rename.json` en **fallback
lecture** (`CompositeMappingStore`, `src/mapping/composite-store.ts`), le temps que les admins
recréent leur config via `/auto-rename`. Dès qu'un mapping Neon existe pour la guild, le fichier est
**ignoré** pour cette guild (Neon fait foi). L'écriture va **toujours** en Neon. **À retirer une
release plus tard** (issue #19), une fois la bascule terminée.

## Conséquences

- **Domaine pur intact** : `src/domain/auto-rename.ts` (diff d'ensembles, priorité) ne change pas ;
  l'invariant ACL ciblée d'ADR-0002 tient. Seule la **provenance** du mapping change (fichier →
  port `MappingStore`).
- **Provenance unique renforcée** : `/aide`, `/auto-rename` et `guildMemberUpdate` lisent tous le
  même port. Le compte « Rôles configurés » de `/aide` devient **par serveur** (`store.list(guildId)`),
  `0` en DM.
- **Chemin chaud protégé** : le cache par guild (invalidé à l'écriture) évite une requête Postgres à
  chaque `guildMemberUpdate`.
- **Bot persistant** : ReNamioos rejoint Moodioos/Collabioos comme bot à projet Neon dédié
  (standard secrets, D8). `DATABASE_URL` vit dans `.env.production` chiffré dotenvx (D7), jamais en
  clair, jamais commitée.
- **Pas de DB en test** : toute la logique (cache, invalidation, fallback, commande) se teste sur des
  **fakes injectés** ; `neon-queries.ts` (drizzle) est couvert par le typecheck et l'exécution réelle.

## Alternatives écartées

- **Rester en fichier (ADR-0004).** Écarté par décision produit : ni multi-serveur, ni modifiable
  depuis Discord, redéploiement obligatoire à chaque changement.
- **Cache global (toutes guilds dans une map plate).** Écarté : l'invalidation deviendrait globale
  (une écriture sur une guild viderait le cache de toutes). Le cache par guild rend l'invalidation
  **ciblée**.
- **Pas de cache (requête Neon à chaque `guildMemberUpdate`).** Écarté : l'événement est dans le
  chemin chaud (chaque changement de rôle de chaque membre) ; un round-trip Postgres systématique est
  inutile pour une config qui change rarement.
- **Migration immédiate sans fallback fichier.** Écartée : casserait l'auto-rename des serveurs
  existants le temps que les admins reconfigurent. Le fallback lecture rend la bascule transparente,
  puis disparaît.
- **Stocker la priorité dans une colonne dédiée.** Écarté : `updated_at` (ordre d'ajout) suffit et
  reste lisible ; pas de colonne à maintenir.
