/**
 * Tests de la logique PURE du journal d'auto-rename (issue #28).
 *
 * Le journal est un RING-BUFFER par guilde : on ne garde que les N evenements les
 * plus recents. La derivation du compteur d'echecs du jour (`failuresToday`) est
 * elle aussi pure : elle se calcule sur une liste d'entrees + un instant de minuit.
 * Aucune dependance Discord ni Neon : on teste sur des primitives en memoire.
 */
import { describe, expect, it } from "bun:test";
import { tronquerJournal, compterEchecsDepuis, type AutoRenameLogEntry } from "./auto-rename-log";

function entree(p: Partial<AutoRenameLogEntry>): AutoRenameLogEntry {
  return {
    guildId: "g1",
    memberId: "m1",
    style: "cursive",
    outcome: "succes",
    detail: "Bob",
    at: new Date("2026-06-12T10:00:00Z"),
    ...p,
  };
}

describe("tronquerJournal — ring-buffer des N plus recents", () => {
  it("garde les N derniers (les plus recents en tete), jette les plus vieux", () => {
    const entrees = [
      entree({ detail: "a", at: new Date("2026-06-12T10:00:00Z") }),
      entree({ detail: "b", at: new Date("2026-06-12T11:00:00Z") }),
      entree({ detail: "c", at: new Date("2026-06-12T12:00:00Z") }),
    ];
    const garde = tronquerJournal(entrees, 2);
    expect(garde.map((e) => e.detail)).toEqual(["c", "b"]);
  });

  it("si moins de N entrees, les garde toutes (recent -> ancien)", () => {
    const entrees = [
      entree({ detail: "a", at: new Date("2026-06-12T10:00:00Z") }),
      entree({ detail: "b", at: new Date("2026-06-12T11:00:00Z") }),
    ];
    expect(tronquerJournal(entrees, 5).map((e) => e.detail)).toEqual(["b", "a"]);
  });

  it("liste vide -> vide", () => {
    expect(tronquerJournal([], 10)).toEqual([]);
  });
});

describe("compterEchecsDepuis — derive le compteur du jour", () => {
  const minuit = new Date("2026-06-12T00:00:00Z");

  it("compte uniquement les echecs au/apres minuit", () => {
    const entrees = [
      entree({ outcome: "echec", at: new Date("2026-06-12T09:00:00Z") }),
      entree({ outcome: "echec", at: new Date("2026-06-12T10:00:00Z") }),
      entree({ outcome: "succes", at: new Date("2026-06-12T11:00:00Z") }),
      entree({ outcome: "echec", at: new Date("2026-06-11T23:59:00Z") }), // hier
    ];
    expect(compterEchecsDepuis(entrees, minuit)).toBe(2);
  });

  it("aucun echec -> 0", () => {
    const entrees = [entree({ outcome: "succes" }), entree({ outcome: "succes" })];
    expect(compterEchecsDepuis(entrees, minuit)).toBe(0);
  });
});
