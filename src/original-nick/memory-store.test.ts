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
