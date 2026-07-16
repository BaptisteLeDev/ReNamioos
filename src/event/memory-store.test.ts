/**
 * Test du MemoryEventStore (dev, sans DATABASE_URL). Reference du contrat du port :
 * un seul event ACTIF par guilde (invariant), exclusion des events echus, arret qui supprime,
 * listing des echus (cleanup du balayage).
 */
import { describe, expect, it } from "bun:test";
import type { EvenementStyle } from "../domain/evenement-style";
import { creerMemoryEventStore } from "./memory-store";

function evt(over: Partial<EvenementStyle> = {}): EvenementStyle {
  return {
    guildId: "g1",
    roleId: "r1",
    style: "gothique",
    startedAt: 1000,
    expiresAt: 1000 + 3_600_000,
    ...over,
  };
}

describe("MemoryEventStore", () => {
  it("getActif renvoie null sans event", async () => {
    const store = creerMemoryEventStore();
    expect(await store.getActif("g1", 2000)).toBeNull();
  });

  it("demarrer puis getActif renvoie l event (tant que non echu)", async () => {
    const store = creerMemoryEventStore();
    expect(await store.demarrer(evt(), 1000)).toBe(true);
    expect(await store.getActif("g1", 2000)).toMatchObject({ style: "gothique", roleId: "r1" });
  });

  it("INTERDIT deux events simultanes : demarrer echoue si un event est actif", async () => {
    const store = creerMemoryEventStore();
    await store.demarrer(evt(), 1000);
    expect(await store.demarrer(evt({ style: "cursive" }), 2000)).toBe(false);
    expect(await store.getActif("g1", 2000)).toMatchObject({ style: "gothique" });
  });

  it("un event ECHU n est plus actif : on peut en redemarrer un", async () => {
    const store = creerMemoryEventStore();
    await store.demarrer(evt({ expiresAt: 5000 }), 1000);
    expect(await store.getActif("g1", 6000)).toBeNull(); // echu
    expect(await store.demarrer(evt({ style: "cursive", expiresAt: 9000 }), 6000)).toBe(true);
    expect(await store.getActif("g1", 7000)).toMatchObject({ style: "cursive" });
  });

  it("arreter supprime l event et le renvoie", async () => {
    const store = creerMemoryEventStore();
    await store.demarrer(evt(), 1000);
    const arrete = await store.arreter("g1");
    expect(arrete).toMatchObject({ style: "gothique" });
    expect(await store.getActif("g1", 2000)).toBeNull();
  });

  it("arreter sans event renvoie null", async () => {
    const store = creerMemoryEventStore();
    expect(await store.arreter("g1")).toBeNull();
  });

  it("listExpires renvoie les events echus (pour le balayage de cleanup)", async () => {
    const store = creerMemoryEventStore();
    await store.demarrer(evt({ guildId: "g1", expiresAt: 5000 }), 1000);
    await store.demarrer(evt({ guildId: "g2", expiresAt: 20000 }), 1000);
    const echus = await store.listExpires(6000);
    expect(echus.map((e) => e.guildId)).toEqual(["g1"]);
  });

  it("l event est isole PAR GUILDE", async () => {
    const store = creerMemoryEventStore();
    await store.demarrer(evt({ guildId: "g1" }), 1000);
    expect(await store.getActif("g2", 2000)).toBeNull();
  });
});
