/**
 * Compteur d'echecs d'auto-rename DU JOUR (issue #28) — partage par les adapters
 * memoire et Neon du journal.
 *
 * Maintient en memoire le nombre d'echecs depuis le dernier changement de jour, pour
 * alimenter `autoRenameFailuresToday` dans getStats() SANS round-trip (le contrat
 * /stats exige un getStats() synchrone et rapide, cf. api/contract.test.ts). La cle de
 * jour est derivee de l'horloge injectee (toISOString tronque a la date) : un nouvel
 * evenement un autre jour remet le compteur a zero. Invariant centralise ici (un seul
 * endroit decide « est-ce encore aujourd'hui ? »), donc identique pour les deux adapters.
 */
import type { AutoRenameLogEntry } from '../domain/auto-rename-log';

export interface CompteurEchecsDuJour {
  /** Prend en compte un evenement : incremente si echec, apres rollover eventuel. */
  enregistrer(entry: AutoRenameLogEntry): void;
  /** Nombre d'echecs du jour courant (selon l'horloge). */
  valeur(): number;
}

function cleDuJour(d: Date): string {
  return d.toISOString().slice(0, 10); // AAAA-MM-JJ
}

export function creerCompteurEchecsDuJour(now: () => Date): CompteurEchecsDuJour {
  let jour = cleDuJour(now());
  let echecs = 0;

  function rollover(): void {
    const aujourdhui = cleDuJour(now());
    if (aujourdhui !== jour) {
      jour = aujourdhui;
      echecs = 0;
    }
  }

  return {
    enregistrer(entry) {
      rollover();
      if (entry.outcome === 'echec') echecs += 1;
    },
    valeur() {
      rollover();
      return echecs;
    },
  };
}
