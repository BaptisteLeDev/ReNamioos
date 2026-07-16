# guildsettings — Réglages de personnalisation par serveur (bounded context)

> Socle de flotte migré du gabarit `Discord-TemplateBot`. Provenance UNIQUE des
> personnalisations d'un serveur : **langue** (i18n) et **couleur d'embed**. `/config` et
> le theming consomment ce port ; jamais la DB directement (mandat `ARCHITECTURE.md`).

## Langage ubiquitaire

| Terme | Définition |
| --- | --- |
| **Réglages (`GuildSettings`)** | Couple `{ preferredLocale, embedColor }` d'un serveur. `null` sur un champ = pas d'override (résolution / couleur par défaut). |
| **Override de langue** | `preferredLocale` posé via `/config langue`. Priorité absolue sur la locale Discord de la guilde (cf. `domain/locale-resolution.ts`). |
| **Override de couleur** | `embedColor` posé via `/config couleur`. `null` = couleur par défaut du bot (theming). |
| **Réglages par défaut** | `REGLAGES_DEFAUT = { preferredLocale: null, embedColor: null }` : ce que `get()` renvoie pour une guilde jamais configurée. |

## Frontières et invariants

- **ADDITIF, jamais fusionné.** Ce contexte est **distinct** de `MappingStore` (rôle→style,
  `src/mapping/`) et de `OriginalNickStore` (pseudo d'origine, `src/original-nick/`). Concerns
  séparés, clés de partition différentes (ici : la guilde entière).
- **`get()` ne renvoie JAMAIS `null`.** Le consommateur ne branche jamais sur l'absence ; il
  lit des défauts. Invariant verrouillé par `store.contract.ts`.
- **VO validés à la construction.** `preferredLocale: LocaleTag | null`, `embedColor: EmbedColor | null`.
  Un `EmbedColor` ne s'obtient que via `parseEmbedColor` → une couleur invalide ne peut pas
  atteindre `.setColor` (theming). L'adapter Neon **re-valide** les colonnes brutes en lecture
  (valeur corrompue non-null → traitée comme non configurée **avec un warn**, jamais silencieux).
- **Domaine pur.** Les VO vivent dans `src/domain/` (test de pureté). Le **port** vit ici (convention
  flotte : le port dans son bounded context, pas dans `domain/`).

## Provenance des données (port / adapters)

| Fichier | Rôle |
| --- | --- |
| `store.ts` | Port `GuildSettingsStore` + type `GuildSettings` + `REGLAGES_DEFAUT`. |
| `store.contract.ts` | Suite de CONTRAT partagée, jouée contre chaque adapter. |
| `memory-store.ts` | Adapter mémoire (dev, sans `DATABASE_URL`). Référence de comportement. |
| `cached-store.ts` | **Décorateur** cache lecture par guilde (TTL 60 s, write-invalidate) + **garde anti-race par génération** (idiome Neon-store ReNamioos). |
| `neon-store.ts` | Adapter Neon : `GuildSettingsQueries` injectées + re-validation des VO. I/O pure (le cache est le décorateur). |
| `neon-queries.ts` | SQL/drizzle concret (`onConflictDoUpdate` ciblant une colonne). Non testé en unitaire. |
| `index.ts` | Composition : `cache(DATABASE_URL ? neon : mémoire)`. |

## Table Neon (`guild_settings`)

Étroite, typée, sans JSON, sans PII, sans TTL (config, pas activité). Migration additive
`drizzle/0001_*.sql` générée depuis `src/db/schema.ts`. Colonnes : `guild_id varchar(20) PK`,
`preferred_locale varchar(5)`, `embed_color integer`, `created_at`, `updated_at`.

Hypothèse **mono-process** (D14) : un conteneur par bot → cache in-process cohérent ; le TTL
borne la staleness. Un scaling horizontal exigerait une invalidation cross-process (hors périmètre).
