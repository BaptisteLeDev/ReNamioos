/**
 * Tests de la règle PURE de fenêtre glissante (compteur à débit borné).
 *
 * Coeur métier commun au cooldown /rename+/random par invocateur (B1, limite 3/60 s)
 * et au budget d'auto-rename par guilde (B2, limite 10/60 s). La règle est une fonction
 * pure : à partir des horodatages des renommages précédents et d'un `maintenant` injecté,
 * elle décide si un nouveau renommage est autorisé, et sinon combien de temps attendre.
 * Aucune I/O, aucun Date.now() implicite (horloge injectée), testable en mémoire.
 */
import { describe, expect, it } from "bun:test";
import { evaluerFenetreGlissante } from "./fenetre-glissante";

const FENETRE = 60_000;

describe("evaluerFenetreGlissante", () => {
  it("autorise quand aucun renommage précédent", () => {
    expect(evaluerFenetreGlissante([], 1_000, 3, FENETRE)).toEqual({ autorise: true });
  });

  it("autorise tant que le nombre dans la fenêtre est sous la limite", () => {
    // 2 renommages récents, limite 3 -> le 3e est autorisé.
    const r = evaluerFenetreGlissante([1_000, 2_000], 3_000, 3, FENETRE);
    expect(r).toEqual({ autorise: true });
  });

  it("refuse quand la limite est atteinte dans la fenêtre et donne l'attente restante", () => {
    // 3 renommages à t=0,1000,2000 ; maintenant=3000 ; fenêtre 60 s ; limite 3.
    // Le plus ancien comptant (t=0) sort de la fenêtre à t=60000 -> attente 57000 ms.
    const r = evaluerFenetreGlissante([0, 1_000, 2_000], 3_000, 3, FENETRE);
    expect(r).toEqual({ autorise: false, attenteMs: 57_000 });
  });

  it("ignore les horodatages hors fenêtre (glissement)", () => {
    // Deux vieux (hors 60 s) + un récent ; limite 3 -> seul 1 compte -> autorisé.
    const r = evaluerFenetreGlissante([-100_000, -80_000, 2_000], 3_000, 3, FENETRE);
    expect(r).toEqual({ autorise: true });
  });

  it("borne exacte : un horodatage à exactement `maintenant - fenêtre` est hors fenêtre", () => {
    // t=0 est à maintenant-fenêtre (60000) -> exclu ; restent 2 dans la fenêtre -> autorisé.
    const r = evaluerFenetreGlissante([0, 30_000, 59_000], 60_000, 3, FENETRE);
    expect(r).toEqual({ autorise: true });
  });

  it("gère une limite plus haute (budget guilde 10/60 s)", () => {
    const dix = Array.from({ length: 10 }, (_, i) => i * 1_000); // t=0..9000
    expect(evaluerFenetreGlissante(dix, 9_500, 10, FENETRE)).toMatchObject({ autorise: false });
    expect(evaluerFenetreGlissante(dix.slice(1), 9_500, 10, FENETRE)).toEqual({ autorise: true });
  });
});
