/**
 * Adapter Neon du port AutoRenameLogStore (issue #28).
 *
 * Persiste le journal dans la table `auto_rename_log` (Neon). A chaque `record`, on
 * INSERE l'evenement puis on PURGE les plus anciens de la guilde au-dela de la capacite
 * (ring-buffer cote DB : la table reste bornee a capaciteParGuild * nb_guildes,
 * minimisation D8). `recent` lit les plus recents deja tries cote SQL.
 *
 * Le compteur d'echecs du jour est tenu EN MEMOIRE (creerCompteurEchecsDuJour, partage
 * avec l'adapter memoire) : getStats() reste synchrone et sans I/O (contrat /stats).
 *
 * Les fonctions de requete sont INJECTEES (`AutoRenameLogQueries`) : le SQL/drizzle vit
 * dans neon-queries.ts ; ce module ne connait que des promesses (testable sans DB).
 */
import type { AutoRenameLogEntry } from "../domain/auto-rename-log";
import type { AutoRenameLogStore } from "./store";
import { creerCompteurEchecsDuJour } from "./compteur-echecs";

/** Frontiere d'I/O injectable : tout l'acces Postgres passe par ces trois fonctions. */
export interface AutoRenameLogQueries {
  /** Insere un evenement. */
  insert(entry: AutoRenameLogEntry): Promise<void>;
  /** Supprime les evenements de la guilde au-dela des `garder` plus recents. */
  purgeOlderThan(guildId: string, garder: number): Promise<void>;
  /** Les `limite` evenements les plus recents de la guilde (recent -> ancien). */
  selectRecent(guildId: string, limite: number): Promise<AutoRenameLogEntry[]>;
}

export interface OptionsNeonLog {
  /** Nombre max d'evenements retenus PAR GUILDE (ring-buffer cote DB). */
  capaciteParGuild: number;
  /** Horloge injectable (tests) pour le compteur du jour. Defaut : Date. */
  now?: () => Date;
}

export function creerNeonAutoRenameLogStore(
  queries: AutoRenameLogQueries,
  options: OptionsNeonLog,
): AutoRenameLogStore {
  const compteur = creerCompteurEchecsDuJour(options.now ?? (() => new Date()));

  return {
    async record(entry) {
      await queries.insert(entry);
      await queries.purgeOlderThan(entry.guildId, options.capaciteParGuild);
      compteur.enregistrer(entry);
    },

    recent(guildId, limite) {
      return queries.selectRecent(guildId, limite);
    },

    failuresToday() {
      return compteur.valeur();
    },
  };
}
