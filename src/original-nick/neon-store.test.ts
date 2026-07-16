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
  upsertWithDeadline: number;
  deleteOne: number;
  selectDue: number;
  selectPendingByGuild: number;
  selectOneWithExpiry: number;
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
  const compteurs: Compteurs = {
    selectByGuild: 0,
    upsertIfAbsent: 0,
    upsertWithDeadline: 0,
    deleteOne: 0,
    selectDue: 0,
    selectPendingByGuild: 0,
    selectOneWithExpiry: 0,
  };
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
    upsertWithDeadline: (guildId, memberId, nick, expiresAt) => {
      compteurs.upsertWithDeadline += 1;
      const m = data.get(guildId) ?? new Map<string, Stockee>();
      const existante = m.get(memberId);
      if (existante) {
        existante.expiresAt = expiresAt; // ON CONFLICT DO UPDATE SET expires_at (garde le nick)
      } else {
        m.set(memberId, { nick, expiresAt });
      }
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
    selectPendingByGuild: (guildId, maintenant) => {
      compteurs.selectPendingByGuild += 1;
      const pending: Array<{ memberId: string; nick: string; expiresAt: number }> = [];
      for (const [memberId, v] of data.get(guildId) ?? new Map<string, Stockee>()) {
        if (v.expiresAt !== null && v.expiresAt > maintenant) {
          pending.push({ memberId, nick: v.nick, expiresAt: v.expiresAt });
        }
      }
      return Promise.resolve(pending);
    },
    selectOneWithExpiry: (guildId, memberId) => {
      compteurs.selectOneWithExpiry += 1;
      const v = data.get(guildId)?.get(memberId);
      return Promise.resolve(v ? { nick: v.nick, expiresAt: v.expiresAt } : null);
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

  it("listPendingByGuild delegue a la DB : echeances A VENIR de la guilde uniquement (#46)", async () => {
    const { queries, compteurs } = fakeQueries({});
    const store = creerNeonOriginalNickStore(queries);
    await store.rememberIfAbsent("g1", "m1", "Bob", 5000); // a venir
    await store.rememberIfAbsent("g1", "m2", "Zoe", 1000); // echue a 2000
    await store.rememberIfAbsent("g1", "m3", "RoleOnly"); // sans echeance
    await store.rememberIfAbsent("g2", "m9", "Autre", 9000); // autre guilde
    expect(await store.listPendingByGuild("g1", 2000)).toEqual([
      { memberId: "m1", nick: "Bob", expiresAt: 5000 },
    ]);
    expect(compteurs.selectPendingByGuild).toBe(1);
  });

  it("getPending renvoie nick+expiresAt pour une ligne temporaire, null pour une ligne role-only (#46)", async () => {
    const { queries } = fakeQueries({});
    const store = creerNeonOriginalNickStore(queries);
    await store.rememberIfAbsent("g1", "temp", "Bob", 4000);
    await store.rememberIfAbsent("g1", "role", "RoleOnly"); // pas d echeance
    expect(await store.getPending("g1", "temp")).toEqual({ nick: "Bob", expiresAt: 4000 });
    expect(await store.getPending("g1", "role")).toBeNull();
    expect(await store.getPending("g1", "absent")).toBeNull();
  });

  it("rememberWithDeadline pose l echeance sur une ligne role-based existante et INVALIDE le cache (audit #38)", async () => {
    const { queries, compteurs } = fakeQueries({});
    const store = creerNeonOriginalNickStore(queries);
    await store.rememberIfAbsent("g1", "m1", "Bob"); // ligne role-based (expiresAt NULL)
    const cree = await store.rememberWithDeadline("g1", "m1", "DejaStylise", 1000);
    expect(cree).toBe(false); // ligne preexistante
    // L echeance est bien posee : listDue la retrouve, l original est preserve.
    expect(await store.listDue(1000)).toEqual([{ guildId: "g1", memberId: "m1", nick: "Bob" }]);
    expect(await store.get("g1", "m1")).toBe("Bob"); // cache invalide + relu
    expect(compteurs.upsertWithDeadline).toBe(1);
  });

  it("rememberWithDeadline sans ligne prealable => created=true", async () => {
    const { queries } = fakeQueries({});
    const store = creerNeonOriginalNickStore(queries);
    const cree = await store.rememberWithDeadline("g1", "m1", "Bob", 1000);
    expect(cree).toBe(true);
    expect(await store.listDue(1000)).toEqual([{ guildId: "g1", memberId: "m1", nick: "Bob" }]);
  });

  it("un selectByGuild EN VOL ne re-peuple PAS le cache apres une invalidation (race, audit)", async () => {
    // Meme race que le mapping store : un read en vol (snapshot perime) resout apres une ecriture
    // qui a invalide le cache ; sans garde il masquerait le nick fraichement memorise.
    const nicks = new Map<string, string>(); // memberId -> nick pour g1
    let libererSelect!: () => void;
    const selectBloque = new Promise<void>((r) => (libererSelect = r));
    let selectCount = 0;
    const queries: OriginalNickQueries = {
      selectByGuild: async () => {
        selectCount += 1;
        // Capture le snapshot AVANT le blocage (deviendra perime apres l'ecriture concurrente).
        const snapshot = [...nicks.entries()].map(([memberId, nick]) => ({ memberId, nick }));
        if (selectCount === 1) await selectBloque; // 1er read EN VOL
        return snapshot;
      },
      upsertIfAbsent: (_g, memberId, nick) => {
        if (!nicks.has(memberId)) nicks.set(memberId, nick);
        return Promise.resolve();
      },
      upsertWithDeadline: () => Promise.resolve(),
      deleteOne: (_g, memberId) => {
        nicks.delete(memberId);
        return Promise.resolve();
      },
      selectDue: () => Promise.resolve([]),
      selectPendingByGuild: () => Promise.resolve([]),
      selectOneWithExpiry: () => Promise.resolve(null),
    };
    const store = creerNeonOriginalNickStore(queries);

    const lecture = store.get("g1", "m1"); // read en vol (snapshot vide)
    await store.rememberIfAbsent("g1", "m1", "Bob"); // ecrit + invalide PENDANT le read
    libererSelect();
    await lecture;

    // Le nick fraichement memorise DOIT etre visible (pas masque par le snapshot perime).
    expect(await store.get("g1", "m1")).toBe("Bob");
  });
});
