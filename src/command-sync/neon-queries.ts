/**
 * Requetes drizzle concretes derriere le port CommandSyncQueries.
 *
 * SEUL fichier qui ecrit du SQL contre `guild_command_sync`. Le NeonCommandSyncStore
 * recoit ces fonctions par injection : il ignore drizzle. Non teste en unitaire (pas
 * de credentials Neon en local) : couvert par le typecheck (drizzle infere les colonnes)
 * et l'execution reelle ; la LOGIQUE est testee sur des fakes.
 */
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { guildCommandSync } from "../db/schema";
import type { CommandSyncQueries } from "./neon-store";

export function creerCommandSyncQueries(db: Db): CommandSyncQueries {
  return {
    async select(guildId) {
      const [row] = await db
        .select({ commandNames: guildCommandSync.commandNames })
        .from(guildCommandSync)
        .where(eq(guildCommandSync.guildId, guildId))
        .limit(1);
      return row?.commandNames ?? null;
    },
    async upsert(guildId, commandNames) {
      await db
        .insert(guildCommandSync)
        .values({ guildId, commandNames })
        .onConflictDoUpdate({
          target: guildCommandSync.guildId,
          set: { commandNames, syncedAt: new Date() },
        });
    },
  };
}
