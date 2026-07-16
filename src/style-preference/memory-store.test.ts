/**
 * Test du MemoryStylePreferenceStore (dev, sans DATABASE_URL). Reference du contrat du port :
 * signature par (guild, membre), reset qui supprime, isolation par serveur.
 */
import { describe, expect, it } from "bun:test";
import { creerMemoryStylePreferenceStore } from "./memory-store";

describe("MemoryStylePreferenceStore", () => {
  it("get renvoie null sans signature posee", async () => {
    const store = creerMemoryStylePreferenceStore();
    expect(await store.get("g1", "m1")).toBeNull();
  });

  it("set puis get renvoie la signature", async () => {
    const store = creerMemoryStylePreferenceStore();
    await store.set("g1", "m1", "gothique");
    expect(await store.get("g1", "m1")).toBe("gothique");
  });

  it("set remplace la signature precedente", async () => {
    const store = creerMemoryStylePreferenceStore();
    await store.set("g1", "m1", "gothique");
    await store.set("g1", "m1", "cursive");
    expect(await store.get("g1", "m1")).toBe("cursive");
  });

  it("clear supprime la signature (retour au style du role)", async () => {
    const store = creerMemoryStylePreferenceStore();
    await store.set("g1", "m1", "gothique");
    await store.clear("g1", "m1");
    expect(await store.get("g1", "m1")).toBeNull();
  });

  it("la signature est CIBLEE par membre et par serveur", async () => {
    const store = creerMemoryStylePreferenceStore();
    await store.set("g1", "m1", "gothique");
    expect(await store.get("g2", "m1")).toBeNull(); // autre serveur
    expect(await store.get("g1", "m2")).toBeNull(); // autre membre
  });
});
