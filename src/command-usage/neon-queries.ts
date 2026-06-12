/**
 * Requetes drizzle concretes derriere le port CommandUsageQueries (issue #27).
 *
 * SEUL fichier qui ecrit du SQL contre `command_daily`. Le NeonCommandUsageStore recoit
 * ces fonctions par injection : il ignore drizzle. On centralise ici la traduction
 * Postgres <-> CompteJournalier (la colonne `date` se rend en "AAAA-MM-JJ"). Non teste en
 * unitaire (pas de credentials Neon en local, cf. les autres neon-queries) : couvert par
 * le typecheck (drizzle infere les colonnes) et l'execution reelle ; la LOGIQUE (cache,
 * fenetre) est testee sur des fakes (neon-store.test.ts).
 */
import { desc, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { commandDaily } from '../db/schema';
import type { CommandUsageQueries } from './neon-store';
import type { CompteJournalier } from '../domain/command-usage';

export function creerCommandUsageQueries(db: Db): CommandUsageQueries {
  return {
    async selectDerniers(limite) {
      const lignes = await db
        .select({ day: commandDaily.day, count: commandDaily.count })
        .from(commandDaily)
        .orderBy(desc(commandDaily.day))
        .limit(limite);
      // drizzle rend une colonne `date` en chaine "AAAA-MM-JJ" (mode string par defaut).
      return lignes.map((l): CompteJournalier => ({ day: l.day, count: l.count }));
    },
    async incrementJour(day) {
      await db
        .insert(commandDaily)
        .values({ day, count: 1 })
        .onConflictDoUpdate({
          target: commandDaily.day,
          set: { count: sql`${commandDaily.count} + 1` },
        });
    },
  };
}
