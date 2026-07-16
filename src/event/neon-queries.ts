/**
 * Requetes drizzle concretes derriere le port EventStore (« Style Party »).
 *
 * SEUL fichier qui ecrit du SQL contre `style_event`. Le NeonEventStore (invariant +
 * revalidation) recoit ces fonctions par injection : il ignore drizzle. Non teste en unitaire
 * (pas de credentials Neon en local) : couvert par le typecheck ; la LOGIQUE (invariant,
 * revalidation, echeance) est testee sur des fakes (neon-store.test.ts).
 */
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { styleEvent } from "../db/schema";
import type { EnregistrementEvent, EventQueries } from "./neon-store";

export function creerNeonEventQueries(db: Db): EventQueries {
  return {
    async selectOne(guildId) {
      const rows = await db
        .select()
        .from(styleEvent)
        .where(eq(styleEvent.guildId, guildId))
        .limit(1);
      return rows[0] ?? null;
    },

    async selectAll() {
      return db.select().from(styleEvent);
    },

    async upsert(record: EnregistrementEvent) {
      await db
        .insert(styleEvent)
        .values(record)
        .onConflictDoUpdate({
          target: styleEvent.guildId,
          set: {
            roleId: record.roleId,
            styleName: record.styleName,
            startedAt: record.startedAt,
            expiresAt: record.expiresAt,
          },
        });
    },

    async deleteOne(guildId) {
      await db.delete(styleEvent).where(eq(styleEvent.guildId, guildId));
    },
  };
}
