/**
 * Règle PURE de fenêtre glissante (compteur à débit borné) — coeur métier commun
 * de l'anti mass-rename (batch #45).
 *
 * Deux usages partagent EXACTEMENT la même arithmétique (règle de 3 respectée :
 * 2 usages d'une logique identique -> une seule règle, pas de duplication) :
 *  - B1 : cooldown de /rename + /random, par invocateur ET par guilde (3 / 60 s).
 *  - B2 : budget d'auto-rename, par guilde (10 / 60 s).
 *
 * La règle ne connaît ni Discord.js ni horloge implicite : l'appelant fournit les
 * horodatages (epoch ms) des renommages précédents et le `maintenant` courant
 * (horloge injectée, idiome du repo). Aucune I/O, testable en mémoire.
 */

/** Cooldown /rename + /random : nombre de renommages autorisés par invocateur/guilde. */
export const LIMITE_RENOMMAGE_PAR_INVOCATEUR = 3;
/** Budget d'auto-rename : renommages automatiques autorisés par guilde. */
export const BUDGET_AUTO_RENAME_PAR_GUILDE = 10;
/** Fenêtre glissante commune aux deux limites (60 s). */
export const FENETRE_RENOMMAGE_MS = 60_000;

/**
 * Décision de la règle : soit c'est autorisé, soit refusé avec l'attente restante
 * (ms) avant qu'un jeton ne se libère. Rend l'état invalide irreprésentable : un
 * refus porte TOUJOURS son `attenteMs`, un succès n'en porte jamais.
 */
export type ResultatFenetre = { autorise: true } | { autorise: false; attenteMs: number };

/**
 * « Un nouveau renommage est-il autorisé maintenant ? » Compte les horodatages
 * STRICTEMENT dans la fenêtre (`> maintenant - fenetreMs`). Sous la limite -> autorisé.
 * Sinon refusé : l'attente est le temps avant que le plus ancien horodatage COMPTANT
 * (celui d'indice `n - limite` une fois triés) ne quitte la fenêtre.
 */
export function evaluerFenetreGlissante(
  horodatages: readonly number[],
  maintenant: number,
  limite: number,
  fenetreMs: number,
): ResultatFenetre {
  const debutFenetre = maintenant - fenetreMs;
  const dansFenetre = horodatages.filter((t) => t > debutFenetre).sort((a, b) => a - b);
  if (dansFenetre.length < limite) return { autorise: true };

  const plusAncienComptant = dansFenetre[dansFenetre.length - limite]!;
  return { autorise: false, attenteMs: plusAncienComptant + fenetreMs - maintenant };
}
