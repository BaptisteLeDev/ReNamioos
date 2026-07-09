/**
 * Requetes drizzle concretes derriere le port AutoRenameLogStore (issue #28).
 *
 * SEUL fichier qui ecrit du SQL contre `auto_rename_log`. Le NeonAutoRenameLogStore
 * recoit ces fonctions par injection : il ignore drizzle. On centralise ici la
 * traduction Postgres <-> AutoRenameLogEntry (anti-corruption cOte infra ; un changement
 * de schema/colonne ne touche que ce fichier).
 *
 * Non teste en unitaire (pas de credentials Neon en local, cf. opt-out/neon-queries) :
 * couvert par le typecheck (drizzle infere les colonnes) et l'execution reelle. La
 * LOGIQUE (ring-buffer, compteur) est testee sur des fakes (neon-store.test.ts).
 */
import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { autoRenameLog } from "../db/schema";
import type { AutoRenameLogQueries } from "./neon-store";
import type { AutoRenameLogEntry, AutoRenameOutcome } from "../domain/auto-rename-log";
import type { StyleName } from "../domain/styles";

export function creerNeonAutoRenameLogQueries(db: Db): AutoRenameLogQueries {
  return {
    async insert(entry) {
      await db.insert(autoRenameLog).values({
        guildId: entry.guildId,
        memberId: entry.memberId,
        style: entry.style,
        outcome: entry.outcome,
        detail: entry.detail,
        at: entry.at,
      });
    },

    async purgeOlderThan(guildId, garder) {
      // Supprime les lignes de la guilde dont l'id est strictement plus ancien que le
      // garder-ieme id le plus recent (ring-buffer : on ne conserve que `garder` lignes).
      const seuil = db
        .select({ id: autoRenameLog.id })
        .from(autoRenameLog)
        .where(eq(autoRenameLog.guildId, guildId))
        .orderBy(desc(autoRenameLog.id))
        .limit(1)
        .offset(garder);
      await db
        .delete(autoRenameLog)
        .where(and(eq(autoRenameLog.guildId, guildId), lt(autoRenameLog.id, sql`(${seuil})`)));
    },

    async selectRecent(guildId, limite) {
      const lignes = await db
        .select({
          guildId: autoRenameLog.guildId,
          memberId: autoRenameLog.memberId,
          style: autoRenameLog.style,
          outcome: autoRenameLog.outcome,
          detail: autoRenameLog.detail,
          at: autoRenameLog.at,
        })
        .from(autoRenameLog)
        .where(eq(autoRenameLog.guildId, guildId))
        .orderBy(desc(autoRenameLog.at))
        .limit(limite);
      return lignes.map(
        (l): AutoRenameLogEntry => ({
          guildId: l.guildId,
          memberId: l.memberId,
          style: l.style as StyleName,
          outcome: l.outcome as AutoRenameOutcome,
          detail: l.detail,
          at: l.at,
        }),
      );
    },
  };
}
