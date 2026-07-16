/**
 * Compteur à fenêtre glissante EN MÉMOIRE — état partagé de l'anti mass-rename (#45).
 *
 * Adapter mince : il tient l'ÉTAT (les horodatages récents par clé) et délègue toute
 * la DÉCISION à la règle pure `evaluerFenetreGlissante` (src/domain/fenetre-glissante).
 * Aucune persistance : la limitation de débit est une donnée d'exécution, éphémère,
 * remise à zéro au redémarrage (pas de file d'attente, cf. B2). Une seule fabrique sert
 * les deux usages (cooldown B1, budget B2), configurés par `limite`/`fenetreMs` ; la clé
 * encode la granularité (invocateur+guilde pour B1, guilde pour B2).
 *
 * L'horloge est injectée (idiome du repo) : les tests pilotent le temps, la prod passe
 * `Date.now`. La purge des horodatages hors fenêtre est paresseuse (à chaque accès).
 */
import {
  evaluerFenetreGlissante,
  type ResultatFenetre,
} from "../domain/fenetre-glissante";

export interface CompteurFenetre {
  /** Décide si la clé peut agir MAINTENANT, sans consommer de jeton. */
  evaluer(cle: string): ResultatFenetre;
  /** Consomme un jeton pour la clé (un renommage vient d'être appliqué/admis). */
  enregistrer(cle: string): void;
}

export interface OptionsCompteurFenetre {
  /** Nombre d'actions autorisées par fenêtre pour une clé donnée. */
  limite: number;
  /** Largeur de la fenêtre glissante (ms). */
  fenetreMs: number;
  /** Horloge injectable (tests). Défaut : `Date.now`. */
  now?: () => number;
}

export function creerCompteurFenetre(options: OptionsCompteurFenetre): CompteurFenetre {
  const { limite, fenetreMs } = options;
  const now = options.now ?? (() => Date.now());
  const horodatagesParCle = new Map<string, number[]>();

  /** Renvoie les horodatages de la clé restreints à la fenêtre (purge paresseuse). */
  function recents(cle: string, maintenant: number): number[] {
    const debut = maintenant - fenetreMs;
    const gardes = (horodatagesParCle.get(cle) ?? []).filter((t) => t > debut);
    if (gardes.length === 0) horodatagesParCle.delete(cle);
    else horodatagesParCle.set(cle, gardes);
    return gardes;
  }

  return {
    evaluer(cle) {
      const maintenant = now();
      return evaluerFenetreGlissante(recents(cle, maintenant), maintenant, limite, fenetreMs);
    },
    enregistrer(cle) {
      const maintenant = now();
      const gardes = recents(cle, maintenant);
      gardes.push(maintenant);
      horodatagesParCle.set(cle, gardes);
    },
  };
}
