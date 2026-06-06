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
import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';

/** Config persistante. Une ligne par (guild, role). Cle = style applique au gain du role. */
export const autoRenameMappings = pgTable(
  'auto_rename_mappings',
  {
    guildId: text('guild_id').notNull(),
    roleId: text('role_id').notNull(),
    styleName: text('style_name').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.roleId] })],
);
