/**
 * Requetes drizzle concretes derriere le port MappingQueries (B8, ADR-0005).
 *
 * SEUL fichier qui ecrit du SQL contre `auto_rename_mappings`. Le NeonMappingStore
 * (cache + invalidation) recoit ces fonctions par injection : il ignore drizzle.
 * On centralise ici la traduction Postgres <-> primitives (anti-corruption cote
 * infra ; un changement de schema/colonne ne touche que ce fichier).
 *
 * Non teste en unitaire (pas de credentials Neon en local, cf. consigne B8) :
 * couvert par le typecheck (drizzle infere les colonnes du schema) et, en bout de
 * chaine, par l'execution reelle. La LOGIQUE (cache, ordre, fallback) est testee
 * sur des fakes (neon-store.test.ts, file-store.test.ts, composite-store.test.ts).
 */
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { autoRenameMappings } from '../db/schema';
import type { MappingQueries } from './neon-store';

export function creerNeonQueries(db: Db): MappingQueries {
  return {
    async selectByGuild(guildId) {
      // ORDRE = anciennete d'ajout (updated_at croissant) => priorite ADR-0004 :
      // le rOle mappe en PREMIER l'emporte en cas de gains multiples.
      const lignes = await db
        .select({ roleId: autoRenameMappings.roleId, styleName: autoRenameMappings.styleName })
        .from(autoRenameMappings)
        .where(eq(autoRenameMappings.guildId, guildId))
        .orderBy(asc(autoRenameMappings.updatedAt));
      return lignes;
    },

    async upsert(guildId, roleId, styleName) {
      await db
        .insert(autoRenameMappings)
        .values({ guildId, roleId, styleName })
        .onConflictDoUpdate({
          target: [autoRenameMappings.guildId, autoRenameMappings.roleId],
          set: { styleName, updatedAt: new Date() },
        });
    },

    async deleteOne(guildId, roleId) {
      await db
        .delete(autoRenameMappings)
        .where(
          and(eq(autoRenameMappings.guildId, guildId), eq(autoRenameMappings.roleId, roleId)),
        );
    },
  };
}
