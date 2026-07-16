/**
 * Test du NeonStylePreferenceStore. On INJECTE les requetes (pas de drizzle ni de vraie DB) :
 * on verifie le cache par guild + son invalidation ciblee a l'ecriture, et la REVALIDATION
 * d'un style corrompu en base (traite comme absent, avec warn — jamais de catch silencieux).
 */
import { describe, expect, it } from "bun:test";
import { creerNeonStylePreferenceStore, type StylePreferenceQueries } from "./neon-store";

interface Compteurs {
  selectByGuild: number;
  upsert: number;
  deleteOne: number;
}

function fakeQueries(initial: Record<string, Record<string, string>> = {}) {
  const data = new Map<string, Map<string, string>>(
    Object.entries(initial).map(([g, m]) => [g, new Map(Object.entries(m))]),
  );
  const compteurs: Compteurs = { selectByGuild: 0, upsert: 0, deleteOne: 0 };
  const queries: StylePreferenceQueries = {
    selectByGuild: (guildId) => {
      compteurs.selectByGuild += 1;
      const m = data.get(guildId) ?? new Map();
      return Promise.resolve([...m.entries()].map(([memberId, styleName]) => ({ memberId, styleName })));
    },
    upsert: (guildId, memberId, styleName) => {
      compteurs.upsert += 1;
      const m = data.get(guildId) ?? new Map<string, string>();
      m.set(memberId, styleName);
      data.set(guildId, m);
      return Promise.resolve();
    },
    deleteOne: (guildId, memberId) => {
      compteurs.deleteOne += 1;
      data.get(guildId)?.delete(memberId);
      return Promise.resolve();
    },
  };
  return { queries, compteurs };
}

describe("NeonStylePreferenceStore", () => {
  it("get renvoie la signature persistee, null sinon", async () => {
    const { queries } = fakeQueries({ g1: { m1: "gothique" } });
    const store = creerNeonStylePreferenceStore(queries);
    expect(await store.get("g1", "m1")).toBe("gothique");
    expect(await store.get("g1", "absent")).toBeNull();
  });

  it("met en CACHE par guild : un 2e get ne refrappe PAS la DB", async () => {
    const { queries, compteurs } = fakeQueries({ g1: { m1: "gothique" } });
    const store = creerNeonStylePreferenceStore(queries);
    await store.get("g1", "m1");
    await store.get("g1", "m2");
    expect(compteurs.selectByGuild).toBe(1);
  });

  it("set persiste et INVALIDE le cache de la guild", async () => {
    const { queries, compteurs } = fakeQueries({});
    const store = creerNeonStylePreferenceStore(queries);
    expect(await store.get("g1", "m1")).toBeNull();
    await store.set("g1", "m1", "cursive");
    expect(await store.get("g1", "m1")).toBe("cursive");
    expect(compteurs.upsert).toBe(1);
    expect(compteurs.selectByGuild).toBe(2);
  });

  it("clear supprime la ligne et INVALIDE le cache (minimisation D8)", async () => {
    const { queries, compteurs } = fakeQueries({ g1: { m1: "gothique" } });
    const store = creerNeonStylePreferenceStore(queries);
    expect(await store.get("g1", "m1")).toBe("gothique");
    await store.clear("g1", "m1");
    expect(await store.get("g1", "m1")).toBeNull();
    expect(compteurs.deleteOne).toBe(1);
  });

  it("un style CORROMPU en base est ignore (traite comme absent)", async () => {
    const { queries } = fakeQueries({ g1: { m1: "style_inexistant" } });
    const store = creerNeonStylePreferenceStore(queries);
    expect(await store.get("g1", "m1")).toBeNull();
  });
});
