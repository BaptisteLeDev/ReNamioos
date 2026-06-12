/**
 * Adapter MEMOIRE du port AutoRenameLogStore (issue #28) — mode DEV, sans DATABASE_URL.
 *
 * Comme l'opt-out memoire, le journal est une donnee d'execution : en dev on le tient
 * EN MEMOIRE (ephemere, perdu au redemarrage). On garde un ring-buffer borne par guilde
 * (capaciteParGuild) pour ne pas grossir sans fin ; `/auto-rename log` reste fonctionnel
 * hors Neon, sans persistance entre runs (acceptable en dev, comme l'opt-out).
 *
 * Le compteur d'echecs du jour vit dans `creerCompteurEchecsDuJour` (partage avec
 * l'adapter Neon) : meme remise a zero au changement de jour, peu importe la source.
 */
import { tronquerJournal, type AutoRenameLogEntry } from '../domain/auto-rename-log';
import type { AutoRenameLogStore } from './store';
import { creerCompteurEchecsDuJour } from './compteur-echecs';

export interface OptionsMemoryLog {
  /** Nombre max d'evenements retenus PAR GUILDE (ring-buffer). */
  capaciteParGuild: number;
  /** Horloge injectable (tests) : detection du changement de jour. Defaut : Date. */
  now?: () => Date;
}

export function creerMemoryAutoRenameLogStore(options: OptionsMemoryLog): AutoRenameLogStore {
  const parGuild = new Map<string, AutoRenameLogEntry[]>();
  const compteur = creerCompteurEchecsDuJour(options.now ?? (() => new Date()));

  return {
    record(entry) {
      const liste = tronquerJournal(
        [...(parGuild.get(entry.guildId) ?? []), entry],
        options.capaciteParGuild,
      );
      parGuild.set(entry.guildId, liste);
      compteur.enregistrer(entry);
      return Promise.resolve();
    },

    recent(guildId, limite) {
      return Promise.resolve(tronquerJournal(parGuild.get(guildId) ?? [], limite));
    },

    failuresToday() {
      return compteur.valeur();
    },
  };
}
