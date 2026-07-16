/**
 * Tests de l'adapter MEMOIRE du port OriginalNickStore (issue #25) — mode DEV.
 *
 * Verifie : memorisation idempotente (ne pas ecraser l'original), lecture, oubli, et
 * isolation par (guild, membre).
 */
import { describe, expect, it } from "bun:test";
import { creerMemoryOriginalNickStore } from "./memory-store";

describe("MemoryOriginalNickStore", () => {
  it("get renvoie null tant que rien n est memorise", async () => {
    const store = creerMemoryOriginalNickStore();
    expect(await store.get("g1", "m1")).toBeNull();
  });

  it("rememberIfAbsent memorise puis get le renvoie", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob");
    expect(await store.get("g1", "m1")).toBe("Bob");
  });

  it("rememberIfAbsent n ECRASE PAS un original deja memorise (idempotence #25)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob");
    await store.rememberIfAbsent("g1", "m1", "𝓑𝓸𝓫"); // re-stylisation : on garde l original
    expect(await store.get("g1", "m1")).toBe("Bob");
  });

  it("forget oublie le pseudo (get -> null ensuite)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob");
    await store.forget("g1", "m1");
    expect(await store.get("g1", "m1")).toBeNull();
  });

  it("isole par (guild, membre)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob");
    expect(await store.get("g1", "autre")).toBeNull();
    expect(await store.get("autre", "m1")).toBeNull();
  });
});

describe("MemoryOriginalNickStore — echeance temporaire (issue #38)", () => {
  it("rememberIfAbsent sans echeance => aucune ligne due (revert role-only)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob");
    expect(await store.listDue(Number.MAX_SAFE_INTEGER)).toEqual([]);
  });

  it("rememberIfAbsent avec echeance => listee comme due une fois l echeance passee", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob", 1000);
    expect(await store.listDue(999)).toEqual([]); // pas encore echu
    expect(await store.listDue(1000)).toEqual([{ guildId: "g1", memberId: "m1", nick: "Bob" }]);
  });

  it("idempotence #25 preservee : la 2e memorisation n ecrase ni le pseudo ni l echeance", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob", 1000);
    await store.rememberIfAbsent("g1", "m1", "𝓑𝓸𝓫", 5000);
    expect(await store.get("g1", "m1")).toBe("Bob");
    expect(await store.listDue(1000)).toEqual([{ guildId: "g1", memberId: "m1", nick: "Bob" }]);
  });

  it("forget retire aussi l echeance (plus due ensuite)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob", 1000);
    await store.forget("g1", "m1");
    expect(await store.listDue(2000)).toEqual([]);
  });
});

describe("MemoryOriginalNickStore — poser/rafraichir une echeance (audit #38)", () => {
  it("rememberWithDeadline sur une ligne role-based (expiresAt NULL) POSE l echeance", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob"); // role-based, sans echeance
    const cree = await store.rememberWithDeadline("g1", "m1", "DejaStylise", 1000);
    expect(cree).toBe(false); // une ligne preexistait
    expect(await store.get("g1", "m1")).toBe("Bob"); // original preserve (pas le pseudo stylise)
    expect(await store.listDue(1000)).toEqual([{ guildId: "g1", memberId: "m1", nick: "Bob" }]);
  });

  it("rememberWithDeadline sans ligne prealable CREE la ligne (created=true)", async () => {
    const store = creerMemoryOriginalNickStore();
    const cree = await store.rememberWithDeadline("g1", "m1", "Bob", 1000);
    expect(cree).toBe(true);
    expect(await store.get("g1", "m1")).toBe("Bob");
    expect(await store.listDue(1000)).toEqual([{ guildId: "g1", memberId: "m1", nick: "Bob" }]);
  });

  it("rememberWithDeadline rafraichit l echeance d une ligne temporaire existante", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberWithDeadline("g1", "m1", "Bob", 1000);
    const cree = await store.rememberWithDeadline("g1", "m1", "Ignore", 5000);
    expect(cree).toBe(false);
    expect(await store.listDue(1000)).toEqual([]); // ancienne echeance ecrasee
    expect(await store.listDue(5000)).toEqual([{ guildId: "g1", memberId: "m1", nick: "Bob" }]);
  });
});

describe("MemoryOriginalNickStore — echeances A VENIR par guilde (issue #46, /rename pending)", () => {
  it("liste vide tant qu aucune echeance temporaire", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob"); // role-only, jamais pending
    expect(await store.listPendingByGuild("g1", 0)).toEqual([]);
  });

  it("ne liste QUE les echeances A VENIR de la guilde (exclut echues, role-only, autres guildes)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob", 5000); // a venir
    await store.rememberIfAbsent("g1", "m2", "Zoe", 1000); // echue a maintenant=2000
    await store.rememberIfAbsent("g1", "m3", "RoleOnly"); // pas d echeance
    await store.rememberIfAbsent("g2", "m9", "Autre", 9000); // autre guilde
    expect(await store.listPendingByGuild("g1", 2000)).toEqual([
      { memberId: "m1", nick: "Bob", expiresAt: 5000 },
    ]);
  });

  it("expose expiresAt pour chaque ligne a venir", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "a", "A", 8000);
    await store.rememberIfAbsent("g1", "b", "B", 3000);
    const pending = await store.listPendingByGuild("g1", 1000);
    expect(pending).toHaveLength(2);
    expect(new Set(pending.map((p) => p.expiresAt))).toEqual(new Set([3000, 8000]));
  });
});

describe("MemoryOriginalNickStore — getPending d un membre (issue #46, /rename cancel)", () => {
  it("null si aucune ligne", async () => {
    const store = creerMemoryOriginalNickStore();
    expect(await store.getPending("g1", "m1")).toBeNull();
  });

  it("null si la ligne n a PAS d echeance (role-only : ne pas annuler un round-trip role)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob");
    expect(await store.getPending("g1", "m1")).toBeNull();
  });

  it("renvoie nick + expiresAt pour un renommage temporaire", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob", 4000);
    expect(await store.getPending("g1", "m1")).toEqual({ nick: "Bob", expiresAt: 4000 });
  });

  it("isole par (guilde, membre)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g1", "m1", "Bob", 4000);
    expect(await store.getPending("g1", "autre")).toBeNull();
    expect(await store.getPending("autre", "m1")).toBeNull();
  });
});
