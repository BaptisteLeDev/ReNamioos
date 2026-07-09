/**
 * Test d'acceptation du NeonOriginalNickStore (issue #25).
 *
 * Adapter Neon du port OriginalNickStore. On INJECTE les fonctions de requete (pas de
 * drizzle ni de vraie DB) : le test verifie le cache par guild (le chemin chaud
 * guildMemberUpdate ne refrappe pas la base) et son invalidation a chaque ecriture, ainsi
 * que l'idempotence de la memorisation (ne pas ecraser l'original).
 */
import { describe, expect, it } from "bun:test";
import { creerNeonOriginalNickStore, type OriginalNickQueries } from "./neon-store";

interface Compteurs {
  selectByGuild: number;
  upsertIfAbsent: number;
  deleteOne: number;
  selectDue: number;
}

interface Stockee {
  nick: string;
  expiresAt: number | null;
}

function fakeQueries(initial: Record<string, Record<string, string>> = {}) {
  const data = new Map<string, Map<string, Stockee>>(
    Object.entries(initial).map(([g, m]) => [
      g,
      new Map(Object.entries(m).map(([id, nick]) => [id, { nick, expiresAt: null }])),
    ]),
  );
  const compteurs: Compteurs = { selectByGuild: 0, upsertIfAbsent: 0, deleteOne: 0, selectDue: 0 };
  const queries: OriginalNickQueries = {
    selectByGuild: (guildId) => {
      compteurs.selectByGuild += 1;
      const m = data.get(guildId) ?? new Map<string, Stockee>();
      return Promise.resolve([...m.entries()].map(([memberId, v]) => ({ memberId, nick: v.nick })));
    },
    upsertIfAbsent: (guildId, memberId, nick, expiresAt) => {
      compteurs.upsertIfAbsent += 1;
      const m = data.get(guildId) ?? new Map<string, Stockee>();
      if (!m.has(memberId)) m.set(memberId, { nick, expiresAt: expiresAt ?? null }); // ON CONFLICT DO NOTHING
      data.set(guildId, m);
      return Promise.resolve();
    },
    deleteOne: (guildId, memberId) => {
      compteurs.deleteOne += 1;
      data.get(guildId)?.delete(memberId);
      return Promise.resolve();
    },
    selectDue: (maintenant) => {
      compteurs.selectDue += 1;
      const dues: Array<{ guildId: string; memberId: string; nick: string }> = [];
      for (const [guildId, m] of data) {
        for (const [memberId, v] of m) {
          if (v.expiresAt !== null && v.expiresAt <= maintenant) {
            dues.push({ guildId, memberId, nick: v.nick });
          }
        }
      }
      return Promise.resolve(dues);
    },
  };
  return { queries, compteurs, data };
}

describe("NeonOriginalNickStore", () => {
  it("get renvoie le nick memorise, null sinon", async () => {
    const { queries } = fakeQueries({ g1: { m1: "Bob" } });
    const store = creerNeonOriginalNickStore(queries);
    expect(await store.get("g1", "m1")).toBe("Bob");
    expect(await store.get("g1", "absent")).toBeNull();
  });

  it("met en CACHE par guild : un 2e get ne refrappe PAS la DB", async () => {
    const { queries, compteurs } = fakeQueries({ g1: { m1: "Bob" } });
    const store = creerNeonOriginalNickStore(queries);
    await store.get("g1", "m1");
    await store.get("g1", "m2");
    expect(compteurs.selectByGuild).toBe(1);
  });

  it("rememberIfAbsent persiste et INVALIDE le cache de la guild", async () => {
    const { queries, compteurs } = fakeQueries({});
    const store = creerNeonOriginalNickStore(queries);
    expect(await store.get("g1", "m1")).toBeNull(); // selectByGuild = 1
    await store.rememberIfAbsent("g1", "m1", "Bob");
    expect(await store.get("g1", "m1")).toBe("Bob"); // relit (cache invalide)
    expect(compteurs.upsertIfAbsent).toBe(1);
    expect(compteurs.selectByGuild).toBe(2);
  });

  it("forget supprime la ligne et INVALIDE le cache (minimisation D8)", async () => {
    const { queries, compteurs } = fakeQueries({ g1: { m1: "Bob" } });
    const store = creerNeonOriginalNickStore(queries);
    expect(await store.get("g1", "m1")).toBe("Bob");
    await store.forget("g1", "m1");
    expect(await store.get("g1", "m1")).toBeNull();
    expect(compteurs.deleteOne).toBe(1);
    expect(compteurs.selectByGuild).toBe(2);
  });

  it("listDue interroge la DB (toutes guildes) sans passer par le cache par guild (#38)", async () => {
    const { queries, compteurs } = fakeQueries({});
    const store = creerNeonOriginalNickStore(queries);
    await store.rememberIfAbsent("g1", "m1", "Bob", 1000);
    await store.rememberIfAbsent("g2", "m9", "Zoe", 3000);
    await store.rememberIfAbsent("g1", "m2", "SansEcheance"); // jamais due
    expect(await store.listDue(1500)).toEqual([{ guildId: "g1", memberId: "m1", nick: "Bob" }]);
    expect(compteurs.selectDue).toBe(1);
  });
});
