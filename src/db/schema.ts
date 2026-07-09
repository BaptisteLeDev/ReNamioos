/**
 * Schema de base (drizzle-orm / Postgres Neon) — B8, cf. decisions/0005.
 *
 * Une seule table : la config auto-rename PAR SERVEUR (guild). C'est de la CONFIG
 * (pas de la donnee d'activite) : persistante, sans TTL, minuscule par construction
 * (cf. DECISIONS.md D8, politique de minimisation du plan gratuit Neon).
 *
 * Reflete EXACTEMENT le DDL deja provisionne sur Neon (projet square-frost-15330405) :
 *
 *   auto_rename_mappings(
 *     guild_id    text,
 *     role_id     text,
 *     style_name  text,
 *     updated_at  timestamptz default now(),
 *     PK (guild_id, role_id)
 *   )
 *
 * Aucune migration generee depuis ce repo : la table existe deja. Ce schema sert
 * uniquement de typage pour les requetes drizzle (provenance des donnees centralisee).
 */
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  bigint,
  integer,
  date,
  index,
} from "drizzle-orm/pg-core";

/** Config persistante. Une ligne par (guild, role). Cle = style applique au gain du role. */
export const autoRenameMappings = pgTable(
  "auto_rename_mappings",
  {
    guildId: text("guild_id").notNull(),
    roleId: text("role_id").notNull(),
    styleName: text("style_name").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.roleId] })],
);

/**
 * Consentement membre a l'auto-rename (issue #27). Une ligne EXISTE uniquement pour un
 * membre qui a REFUSE l'auto-rename sur ce serveur (`/renamioos opt-out`). Le defaut =
 * consentement = ABSENCE de ligne ; `opt-in` supprime la ligne. Minimisation D8
 * respectee : seuls les refus (rares) sont stockes, jamais l'ensemble des membres.
 *
 * DDL (a provisionner sur Neon, comme les autres tables — aucune migration generee ici) :
 *
 *   auto_rename_optouts(
 *     guild_id   text,
 *     member_id  text,
 *     PK (guild_id, member_id)
 *   )
 */
export const autoRenameOptouts = pgTable(
  "auto_rename_optouts",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.memberId] })],
);

/**
 * Pseudo SOURCE memorise avant un auto-rename (issue #25) — pour le ROUND-TRIP : quand le
 * membre perd son dernier role mappe, on restaure ce pseudo. Cle (guild_id, member_id) :
 * un seul pseudo d'origine memorise par membre et par serveur.
 *
 * Minimisation D8 : une ligne n'existe QUE tant qu'un membre est sous auto-rename actif ;
 * la restauration au retrait du dernier role mappe SUPPRIME la ligne. Une re-stylisation
 * ulterieure re-memorise (sans ecraser un original deja present). Table petite (seuls les
 * membres actuellement stylises).
 *
 * RENOMMAGE TEMPORAIRE (issue #38) : colonne `expires_at` NULLABLE. NULL => revert pilote
 * par la perte du dernier role mappe (#25, inchange). Non NULL => echeance d'auto-revert :
 * un job de balayage restaure puis SUPPRIME la ligne des `expires_at <= now()`. Index partiel
 * sur les lignes echeancees pour que le balayage reste leger (la plupart des lignes #25 ont
 * `expires_at IS NULL`).
 *
 * DDL (a provisionner sur Neon, comme les autres tables — aucune migration generee ici) :
 *
 *   auto_rename_original_nicks(
 *     guild_id      text,
 *     member_id     text,
 *     original_nick text not null,
 *     expires_at    timestamptz,            -- #38 : NULL = revert par role uniquement
 *     PK (guild_id, member_id)
 *   );
 *   create index auto_rename_original_nicks_expires_at
 *     on auto_rename_original_nicks (expires_at) where expires_at is not null;
 */
export const autoRenameOriginalNicks = pgTable(
  "auto_rename_original_nicks",
  {
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    originalNick: text("original_nick").notNull(),
    /** Echeance d'auto-revert (#38). NULL = pas de revert temporise (round-trip par role #25). */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.guildId, t.memberId] }),
    index("auto_rename_original_nicks_expires_at").on(t.expiresAt),
  ],
);

/**
 * Journal d'auto-rename (issue #28) — N derniers evenements succes/echec PAR GUILDE.
 *
 * Donnee d'ACTIVITE (pas de config), bornee par construction : un ring-buffer cOte DB
 * (purge des plus anciens au-dela de la capacite a chaque insert, cf. NeonAutoRenameLogStore)
 * garde la table petite (capacite * nombre de guildes), minimisation D8. La metrique
 * `autoRenameFailuresToday` de /stats se DERIVE d'un compteur memoire, pas de cette table.
 *
 * DDL (a provisionner sur Neon, comme les autres tables — aucune migration generee ici) :
 *
 *   auto_rename_log(
 *     id        bigint generated always as identity primary key,
 *     guild_id  text not null,
 *     member_id text not null,
 *     style     text not null,
 *     outcome   text not null,   -- 'succes' | 'echec'
 *     detail    text not null,   -- pseudo applique (succes) ou raison (echec)
 *     at        timestamptz not null default now()
 *   );
 *   create index auto_rename_log_guild_at on auto_rename_log (guild_id, at desc);
 */
export const autoRenameLog = pgTable(
  "auto_rename_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    style: text("style").notNull(),
    /** 'succes' | 'echec' (cf. AutoRenameOutcome, domain/auto-rename-log.ts). */
    outcome: text("outcome").notNull(),
    detail: text("detail").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auto_rename_log_guild_at").on(t.guildId, t.at.desc())],
);

/**
 * Persistante. Une ligne par serveur : instantane des noms de commandes synchronises
 * via /update, pour mettre en evidence les "nouvelles" a la synchro suivante. Minuscule
 * par construction (~7 noms courts), politique de minimisation Neon respectee.
 */
export const guildCommandSync = pgTable("guild_command_sync", {
  guildId: text("guild_id").primaryKey(),
  /** Noms tries joints par virgule (les noms de slash-commands n'en contiennent jamais). */
  commandNames: text("command_names").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Suivi d'usage des commandes (issue #27) — un compteur PAR JOUR (UTC), toutes guildes
 * confondues. Alimente la serie `commandsDaily` de /stats (30 derniers jours). Donnee
 * d'ACTIVITE agregee : une ligne par jour, jamais par commande ni par membre — la table
 * croit d'une ligne/jour et reste minuscule (minimisation D8). Le bot ne purge pas : un
 * historique de comptes journaliers est negligeable.
 *
 * DDL (a provisionner sur Neon, comme les autres tables — aucune migration generee ici) :
 *
 *   command_daily(
 *     day   date primary key,   -- jour UTC
 *     count integer not null default 0
 *   );
 */
export const commandDaily = pgTable("command_daily", {
  /** Jour UTC (cle). Stocke en `date` Postgres ; rendu "AAAA-MM-JJ" cote requete. */
  day: date("day").primaryKey(),
  count: integer("count").notNull().default(0),
});
