/**
 * Requetes drizzle concretes derriere le port OptOutStore (issue #27).
 *
 * SEUL fichier qui ecrit du SQL contre `auto_rename_optouts`. Le NeonOptOutStore
 * (cache + invalidation) recoit ces fonctions par injection : il ignore drizzle.
 * On centralise ici la traduction Postgres <-> primitives (anti-corruption cote infra ;
 * un changement de schema/colonne ne touche que ce fichier).
 *
 * Non teste en unitaire (pas de credentials Neon en local, cf. neon-queries du mapping) :
 * couvert par le typecheck (drizzle infere les colonnes du schema) et par l'execution
 * reelle. La LOGIQUE (cache, invalidation) est testee sur des fakes (neon-store.test.ts).
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { autoRenameOptouts } from '../db/schema';
import type { OptOutQueries } from './neon-store';

export function creerNeonOptOutQueries(db: Db): OptOutQueries {
  return {
    async selectByGuild(guildId) {
      const lignes = await db
        .select({ memberId: autoRenameOptouts.memberId })
        .from(autoRenameOptouts)
        .where(eq(autoRenameOptouts.guildId, guildId));
      return lignes.map((l) => l.memberId);
    },

    async insert(guildId, memberId) {
      // ON CONFLICT DO NOTHING : opt-out idempotent sur la PK (guild_id, member_id).
      await db
        .insert(autoRenameOptouts)
        .values({ guildId, memberId })
        .onConflictDoNothing();
    },

    async deleteOne(guildId, memberId) {
      await db
        .delete(autoRenameOptouts)
        .where(
          and(eq(autoRenameOptouts.guildId, guildId), eq(autoRenameOptouts.memberId, memberId)),
        );
    },
  };
}
