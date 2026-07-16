/**
 * Tests du compteur à fenêtre glissante EN MÉMOIRE (adapter d'état partagé).
 *
 * Le compteur tient, par clé, les horodatages des renommages récents et délègue la
 * DÉCISION à la règle pure `evaluerFenetreGlissante`. Il porte l'horloge injectable
 * (tests déterministes) et purge paresseusement les horodatages hors fenêtre. Deux
 * instances configurées différemment servent le cooldown (B1, clé invocateur+guilde)
 * et le budget d'auto-rename (B2, clé guilde).
 */
import { describe, expect, it } from "bun:test";
import { creerCompteurFenetre } from "./compteur-fenetre";

/** Horloge mutable pour piloter le temps dans les tests. */
function horlogeMutable(depart = 0) {
  let t = depart;
  return { now: () => t, avancer: (ms: number) => (t += ms) };
}

describe("creerCompteurFenetre", () => {
  it("autorise sous la limite et refuse une fois la limite atteinte", () => {
    const h = horlogeMutable(1_000);
    const compteur = creerCompteurFenetre({ now: h.now, limite: 3, fenetreMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      expect(compteur.evaluer("k").autorise).toBe(true);
      compteur.enregistrer("k");
      h.avancer(1_000);
    }
    const r = compteur.evaluer("k");
    expect(r.autorise).toBe(false);
    if (!r.autorise) expect(r.attenteMs).toBeGreaterThan(0);
  });

  it("isole les clés : un autre invocateur/guilde n'est pas impacté", () => {
    const h = horlogeMutable(0);
    const compteur = creerCompteurFenetre({ now: h.now, limite: 1, fenetreMs: 60_000 });
    compteur.enregistrer("a");
    expect(compteur.evaluer("a").autorise).toBe(false);
    expect(compteur.evaluer("b").autorise).toBe(true);
  });

  it("re-autorise après que la fenêtre a glissé", () => {
    const h = horlogeMutable(0);
    const compteur = creerCompteurFenetre({ now: h.now, limite: 1, fenetreMs: 60_000 });
    compteur.enregistrer("k");
    expect(compteur.evaluer("k").autorise).toBe(false);
    h.avancer(60_001);
    expect(compteur.evaluer("k").autorise).toBe(true);
  });
});
