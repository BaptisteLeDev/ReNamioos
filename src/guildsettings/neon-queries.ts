/**
 * Requetes drizzle concretes derriere le port GuildSettingsStore (socle de flotte).
 *
 * SEUL fichier qui ecrit du SQL contre `guild_settings`. Le NeonGuildSettingsStore
 * (revalidation des VO) recoit ces fonctions par injection : il ignore drizzle. On
 * centralise ici la traduction Postgres <-> primitives (anti-corruption cote infra ; un
 * changement de schema/colonne ne touche que ce fichier).
 *
 * Chaque setter fait un upsert ciblant SA colonne (idiome `onConflictDoUpdate`, cf.
 * mapping/neon-queries.ts), sans ecraser l'autre reglage. `updated_at` est rafraichi a
 * chaque ecriture.
 *
 * Non teste en unitaire (pas de credentials Neon en local, cf. original-nick/mapping) :
 * couvert par le typecheck et l'execution reelle. La LOGIQUE (revalidation) est testee sur
 * des fakes (neon-store.test.ts).
 */
import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { guildSettings } from "../db/schema";
import type { GuildSettingsQueries } from "./neon-store";

export function creerNeonGuildSettingsQueries(db: Db): GuildSettingsQueries {
  return {
    async selectOne(guildId) {
      const lignes = await db
        .select({
          preferredLocale: guildSettings.preferredLocale,
          embedColor: guildSettings.embedColor,
        })
        .from(guildSettings)
        .where(eq(guildSettings.guildId, guildId))
        .limit(1);
      return lignes[0] ?? null;
    },

    async upsertLocale(guildId, locale) {
      await db
        .insert(guildSettings)
        .values({ guildId, preferredLocale: locale })
        .onConflictDoUpdate({
          target: guildSettings.guildId,
          set: { preferredLocale: locale, updatedAt: sql`now()` },
        });
    },

    async upsertEmbedColor(guildId, color) {
      await db
        .insert(guildSettings)
        .values({ guildId, embedColor: color })
        .onConflictDoUpdate({
          target: guildSettings.guildId,
          set: { embedColor: color, updatedAt: sql`now()` },
        });
    },
  };
}
