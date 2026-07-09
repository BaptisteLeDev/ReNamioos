/**
 * Test d'acceptation du CompositeMappingStore (B8, ADR-0005).
 *
 * Store de TRANSITION utilise en mode Neon : la PROVENANCE est Neon, mais tant
 * qu'une guild n'a AUCUN mapping en base, on lit le fichier `auto-rename.json` en
 * FALLBACK (le temps que les admins recreent leur config via /auto-rename). Des
 * qu'une guild a au moins un mapping Neon, le fichier est IGNORE pour cette guild
 * (Neon fait foi). L'ECRITURE va toujours en Neon. A retirer une release plus tard
 * (cf. issue #19, ADR-0005).
 */
import { describe, expect, it } from "bun:test";
import type { MappingStore } from "./store";
import { creerFileMappingStore } from "./file-store";
import { creerCompositeMappingStore } from "./composite-store";

/** Store Neon factice en memoire (par guild), pour isoler la logique de fallback. */
function fakeNeon(initial: Record<string, Record<string, string>> = {}): MappingStore {
  const data = new Map<string, Map<string, string>>(
    Object.entries(initial).map(([g, m]) => [g, new Map(Object.entries(m))]),
  );
  return {
    styleForRole: (g, r) => Promise.resolve((data.get(g)?.get(r) as never) ?? null),
    add: (g, r, s) => {
      const m = data.get(g) ?? new Map();
      m.set(r, s);
      data.set(g, m);
      return Promise.resolve();
    },
    remove: (g, r) => {
      data.get(g)?.delete(r);
      return Promise.resolve();
    },
    list: (g) => Promise.resolve(Object.fromEntries(data.get(g) ?? new Map()) as never),
  };
}

describe("CompositeMappingStore (fallback fichier en transition)", () => {
  it("guild AVEC mapping Neon -> Neon fait foi, le fichier est ignore", async () => {
    const neon = fakeNeon({ g1: { r1: "cursive" } });
    const fichier = creerFileMappingStore({ rFichier: "gothique" });
    const store = creerCompositeMappingStore(neon, fichier);
    expect(await store.list("g1")).toEqual({ r1: "cursive" });
    expect(await store.styleForRole("g1", "rFichier")).toBeNull();
  });

  it("guild SANS mapping Neon -> fallback LECTURE sur le fichier", async () => {
    const neon = fakeNeon({});
    const fichier = creerFileMappingStore({ rFichier: "gothique" });
    const store = creerCompositeMappingStore(neon, fichier);
    expect(await store.list("nouvelle-guild")).toEqual({ rFichier: "gothique" });
    expect(await store.styleForRole("nouvelle-guild", "rFichier")).toBe("gothique");
  });

  it("add ecrit en NEON et bascule la guild hors du fallback fichier", async () => {
    const neon = fakeNeon({});
    const fichier = creerFileMappingStore({ rFichier: "gothique" });
    const store = creerCompositeMappingStore(neon, fichier);
    // Avant : fallback fichier.
    expect(await store.list("g1")).toEqual({ rFichier: "gothique" });
    // On ecrit en Neon -> la guild a desormais un mapping Neon.
    await store.add("g1", "r1", "double");
    // Apres : Neon fait foi, le fichier n'est plus consulte.
    expect(await store.list("g1")).toEqual({ r1: "double" });
  });

  it("remove est delegue a Neon", async () => {
    const neon = fakeNeon({ g1: { r1: "cursive", r2: "gras" } });
    const fichier = creerFileMappingStore({});
    const store = creerCompositeMappingStore(neon, fichier);
    await store.remove("g1", "r1");
    expect(await store.list("g1")).toEqual({ r2: "gras" });
  });

  it("fichier vide ET Neon vide -> mapping vide (pas de fallback utile)", async () => {
    const neon = fakeNeon({});
    const fichier = creerFileMappingStore({});
    const store = creerCompositeMappingStore(neon, fichier);
    expect(await store.list("g1")).toEqual({});
  });
});
