# Provenance auto-rename — le port `MappingStore` (bounded context)

> **Responsabilité unique** : savoir *d'où vient* la config auto-rename (rôle → style) et la lire /
> l'écrire, sans que les adapters Discord connaissent la source. C'est le point de **provenance
> centralisée** du mandat `ARCHITECTURE.md`. Introduit en B8
> ([ADR-0005](../../decisions/0005-config-auto-rename-neon.md), supersède
> [ADR-0004](../../decisions/0004-auto-rename.md), config fichier).

## Langage ubiquitaire

| Terme | Définition |
|---|---|
| **Mapping** | Association `roleId → styleName` pour un serveur. Type domaine : `MappingRoleStyle` (objet ordonné). |
| **Guild** | Serveur Discord. Clé de partition (`guild_id`) : la config est **par serveur**. |
| **Priorité** | Quand un membre gagne plusieurs rôles mappés d'un coup, le **premier** du mapping ordonné gagne. En Neon : ordre = `updated_at` croissant (ordre d'ajout). |
| **Mode fichier / mode Neon** | Branché par `DATABASE_URL` : absente ⇒ fichier (dev), présente ⇒ Neon (prod). |
| **Fallback (transition)** | En mode Neon, lecture du fichier tant qu'une guild n'a aucun mapping en base. Transitoire (à retirer une release plus tard). |

## API publique (port `MappingStore`)

```ts
interface MappingStore {
  styleForRole(guildId: string, roleId: string): Promise<StyleName | null>;
  add(guildId: string, roleId: string, styleName: StyleName): Promise<void>;
  remove(guildId: string, roleId: string): Promise<void>;
  list(guildId: string): Promise<MappingRoleStyle>; // ordonné = priorité
}
```

Composition : `creerMappingStore({ databaseUrl, mappingFichier, queries? })` (`index.ts`).

## Fichiers et responsabilités

| Fichier | Rôle |
|---|---|
| `store.ts` | Le **port** (interface). Tout consommateur (commande `/auto-rename`, `/aide`, événement `guildMemberUpdate`) en dépend, jamais d'un adapter concret. |
| `neon-store.ts` | Adapter **Neon** : cache en mémoire **par guild**, invalidé (ciblé) à chaque écriture. Reçoit `MappingQueries` par **injection** (testable sans DB). |
| `neon-queries.ts` | Requêtes **drizzle** concrètes (seul fichier qui écrit du SQL contre `auto_rename_mappings`). `selectByGuild` ordonne par `updated_at` (priorité). |
| `file-store.ts` | Adapter **fichier** (dev) : lit le mapping injecté ; écriture refusée (erreur explicite → mode Neon). |
| `composite-store.ts` | Neon + **fallback lecture** fichier (transition). Écriture toujours en Neon. |
| `index.ts` | **Composition** : branche le bon adapter selon `DATABASE_URL`. |

## Provenance des données

- **Neon** (prod) : table `auto_rename_mappings(guild_id, role_id, style_name, updated_at)`,
  PK `(guild_id, role_id)`. Déjà provisionnée (projet `square-frost-15330405`) — **aucune migration
  générée** depuis ce repo ; `src/db/schema.ts` ne sert qu'au typage drizzle.
- **Fichier** (dev / fallback) : `auto-rename.json`, chargé+validé au boot par
  `src/config/auto-rename-config.ts` (zod). Injecté dans `FileMappingStore`.

## Invariants

- **Source unique** : aucun consommateur ne lit `auto-rename.json` ni la table en direct ; tout passe
  par le port. Changer la source ⇒ un seul point (`index.ts` + l'adapter concerné).
- **Cache invalidé à l'écriture** : après `add`/`remove`, le `list` suivant de **cette** guild relit
  la base ; les autres guilds gardent leur cache (invalidation ciblée).
- **Init paresseuse de la DB** : aucune connexion Postgres en mode fichier (cf. `src/db/client.ts`).
- **Domaine pur intact** : ce contexte ne porte aucune règle de stylisation ni de détection de rôle ;
  il fournit le `MappingRoleStyle` ordonné que le domaine (`src/domain/auto-rename.ts`) consomme.

## Tests

Toute la logique (cache, invalidation ciblée, fallback, composition, lecture seule fichier) est
testée sur des **fakes injectés** — `neon-store.test.ts`, `file-store.test.ts`,
`composite-store.test.ts`, `index.test.ts`. `neon-queries.ts` (drizzle) est couvert par le typecheck
et l'exécution réelle (pas de DB en test, par consigne B8).
