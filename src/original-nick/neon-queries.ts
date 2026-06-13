/**
 * Requetes drizzle concretes derriere le port OriginalNickStore (issue #25).
 *
 * SEUL fichier qui ecrit du SQL contre `auto_rename_original_nicks`. Le
 * NeonOriginalNickStore (cache + invalidation) recoit ces fonctions par injection : il
 * ignore drizzle. On centralise ici la traduction Postgres <-> primitives (anti-corruption
 * cote infra ; un changement de schema/colonne ne touche que ce fichier).
 *
 * Non teste en unitaire (pas de credentials Neon en local, cf. opt-out/neon-queries) :
 * couvert par le typecheck et l'execution reelle. La LOGIQUE (cache) est testee sur des
 * fakes (neon-store.test.ts).
 */
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import type { Db } from '../db/client';
import { autoRenameOriginalNicks } from '../db/schema';
import type { OriginalNickQueries } from './neon-store';

export function creerNeonOriginalNickQueries(db: Db): OriginalNickQueries {
  return {
    async selectByGuild(guildId) {
      const lignes = await db
        .select({
          memberId: autoRenameOriginalNicks.memberId,
          nick: autoRenameOriginalNicks.originalNick,
        })
        .from(autoRenameOriginalNicks)
        .where(eq(autoRenameOriginalNicks.guildId, guildId));
      return lignes;
    },

    async upsertIfAbsent(guildId, memberId, nick, expiresAt) {
      // ON CONFLICT DO NOTHING : ne pas ecraser l'original ni son echeance si deja memorise
      // (#25/#38). expiresAt absent => colonne NULL (revert par role uniquement).
      await db
        .insert(autoRenameOriginalNicks)
        .values({
          guildId,
          memberId,
          originalNick: nick,
          expiresAt: expiresAt !== undefined ? new Date(expiresAt) : null,
        })
        .onConflictDoNothing();
    },

    async deleteOne(guildId, memberId) {
      await db
        .delete(autoRenameOriginalNicks)
        .where(
          and(
            eq(autoRenameOriginalNicks.guildId, guildId),
            eq(autoRenameOriginalNicks.memberId, memberId),
          ),
        );
    },

    async selectDue(maintenant) {
      // Lignes echeancees ET echues (#38). L'index partiel `where expires_at is not null`
      // garde le balayage leger (les lignes #25 sans echeance sont ignorees).
      const lignes = await db
        .select({
          guildId: autoRenameOriginalNicks.guildId,
          memberId: autoRenameOriginalNicks.memberId,
          nick: autoRenameOriginalNicks.originalNick,
        })
        .from(autoRenameOriginalNicks)
        .where(
          and(
            isNotNull(autoRenameOriginalNicks.expiresAt),
            lte(autoRenameOriginalNicks.expiresAt, new Date(maintenant)),
          ),
        );
      return lignes;
    },
  };
}
