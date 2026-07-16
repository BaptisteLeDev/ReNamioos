/**
 * Test du NeonEventStore. On INJECTE les requetes (pas de drizzle ni de vraie DB) : on verifie
 * l'invariant (un seul actif), l'exclusion des echus, et la REVALIDATION d'un style corrompu
 * en base (event inerte, warn — jamais de catch silencieux). Cold-path : aucun cache.
 */
import { describe, expect, it } from "bun:test";
import { creerNeonEventStore, type EnregistrementEvent, type EventQueries } from "./neon-store";

function fakeQueries(initial: EnregistrementEvent[] = []) {
  const data = new Map<string, EnregistrementEvent>(initial.map((e) => [e.guildId, e]));
  const queries: EventQueries = {
    selectOne: (g) => Promise.resolve(data.get(g) ?? null),
    selectAll: () => Promise.resolve([...data.values()]),
    upsert: (e) => {
      data.set(e.guildId, e);
      return Promise.resolve();
    },
    deleteOne: (g) => {
      data.delete(g);
      return Promise.resolve();
    },
  };
  return { queries, data };
}

const REC: EnregistrementEvent = {
  guildId: "g1",
  roleId: "r1",
  styleName: "gothique",
  startedAt: 1000,
  expiresAt: 5000,
};

describe("NeonEventStore", () => {
  it("getActif renvoie l event valide non echu", async () => {
    const store = creerNeonEventStore(fakeQueries([REC]).queries);
    expect(await store.getActif("g1", 2000)).toMatchObject({ style: "gothique", roleId: "r1" });
  });

  it("getActif exclut l event echu", async () => {
    const store = creerNeonEventStore(fakeQueries([REC]).queries);
    expect(await store.getActif("g1", 6000)).toBeNull();
  });

  it("demarrer refuse si un event actif existe (invariant)", async () => {
    const { queries } = fakeQueries([REC]);
    const store = creerNeonEventStore(queries);
    const nouveau = { guildId: "g1", roleId: "r2", style: "cursive" as const, startedAt: 2000, expiresAt: 9000 };
    expect(await store.demarrer(nouveau, 2000)).toBe(false);
  });

  it("demarrer remplace un event echu et renvoie true", async () => {
    const { queries } = fakeQueries([REC]);
    const store = creerNeonEventStore(queries);
    const nouveau = { guildId: "g1", roleId: "r2", style: "cursive" as const, startedAt: 6000, expiresAt: 9000 };
    expect(await store.demarrer(nouveau, 6000)).toBe(true);
    expect(await store.getActif("g1", 7000)).toMatchObject({ style: "cursive" });
  });

  it("arreter supprime et renvoie l event", async () => {
    const { queries } = fakeQueries([REC]);
    const store = creerNeonEventStore(queries);
    expect(await store.arreter("g1")).toMatchObject({ style: "gothique" });
    expect(await store.getActif("g1", 2000)).toBeNull();
  });

  it("listExpires renvoie les events echus", async () => {
    const { queries } = fakeQueries([
      REC,
      { guildId: "g2", roleId: "r9", styleName: "cursive", startedAt: 1000, expiresAt: 99999 },
    ]);
    const store = creerNeonEventStore(queries);
    const echus = await store.listExpires(6000);
    expect(echus.map((e) => e.guildId)).toEqual(["g1"]);
  });

  it("un style CORROMPU en base rend l event inerte (getActif null)", async () => {
    const { queries } = fakeQueries([{ ...REC, styleName: "inexistant" }]);
    const store = creerNeonEventStore(queries);
    expect(await store.getActif("g1", 2000)).toBeNull();
  });
});
