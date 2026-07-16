/**
 * Requetes drizzle concretes derriere le port StylePreferenceStore.
 *
 * SEUL fichier qui ecrit du SQL contre `auto_rename_style_preferences`. Le
 * NeonStylePreferenceStore (cache + revalidation) recoit ces fonctions par injection : il
 * ignore drizzle. Non teste en unitaire (pas de credentials Neon en local) : couvert par le
 * typecheck (drizzle infere les colonnes) et l'execution reelle ; la LOGIQUE (cache,
 * invalidation, revalidation) est testee sur des fakes (neon-store.test.ts).
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { autoRenameStylePreferences } from "../db/schema";
import type { StylePreferenceQueries } from "./neon-store";

export function creerNeonStylePreferenceQueries(db: Db): StylePreferenceQueries {
  return {
    async selectByGuild(guildId) {
      return db
        .select({
          memberId: autoRenameStylePreferences.memberId,
          styleName: autoRenameStylePreferences.styleName,
        })
        .from(autoRenameStylePreferences)
        .where(eq(autoRenameStylePreferences.guildId, guildId));
    },

    async upsert(guildId, memberId, styleName) {
      await db
        .insert(autoRenameStylePreferences)
        .values({ guildId, memberId, styleName })
        .onConflictDoUpdate({
          target: [autoRenameStylePreferences.guildId, autoRenameStylePreferences.memberId],
          set: { styleName },
        });
    },

    async deleteOne(guildId, memberId) {
      await db
        .delete(autoRenameStylePreferences)
        .where(
          and(
            eq(autoRenameStylePreferences.guildId, guildId),
            eq(autoRenameStylePreferences.memberId, memberId),
          ),
        );
    },
  };
}
