/**
 * Test d'acceptation du NeonAutoRenameLogStore (issue #28).
 *
 * Adapter Neon du port AutoRenameLogStore. On INJECTE les fonctions de requete (pas de
 * drizzle ni de vraie DB) : le test verifie que record delegue insert+purge, que recent
 * delegue selectRecent, et que le compteur d'echecs du jour est tenu EN MEMOIRE (pas un
 * round-trip Postgres dans getStats()).
 */
import { describe, expect, it } from "bun:test";
import { creerNeonAutoRenameLogStore, type AutoRenameLogQueries } from "./neon-store";
import type { AutoRenameLogEntry } from "../domain/auto-rename-log";

function entree(p: Partial<AutoRenameLogEntry> = {}): AutoRenameLogEntry {
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

function fakeQueries() {
  const inserts: AutoRenameLogEntry[] = [];
  const purges: Array<{ guildId: string; garder: number }> = [];
  let selectReturn: AutoRenameLogEntry[] = [];
  const queries: AutoRenameLogQueries = {
    insert: (e) => {
      inserts.push(e);
      return Promise.resolve();
    },
    purgeOlderThan: (guildId, garder) => {
      purges.push({ guildId, garder });
      return Promise.resolve();
    },
    selectRecent: () => Promise.resolve(selectReturn),
  };
  return {
    queries,
    inserts,
    purges,
    setSelectReturn: (v: AutoRenameLogEntry[]) => {
      selectReturn = v;
    },
  };
}

describe("NeonAutoRenameLogStore", () => {
  it("record insere puis purge au-dela de la capacite", async () => {
    const { queries, inserts, purges } = fakeQueries();
    const store = creerNeonAutoRenameLogStore(queries, { capaciteParGuild: 50 });
    await store.record(entree({ detail: "x" }));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.detail).toBe("x");
    expect(purges).toEqual([{ guildId: "g1", garder: 50 }]);
  });

  it("recent delegue a selectRecent (deja trie cote SQL)", async () => {
    const { queries, setSelectReturn } = fakeQueries();
    const store = creerNeonAutoRenameLogStore(queries, { capaciteParGuild: 50 });
    setSelectReturn([entree({ detail: "c" }), entree({ detail: "b" })]);
    const r = await store.recent("g1", 2);
    expect(r.map((e) => e.detail)).toEqual(["c", "b"]);
  });

  it("failuresToday compte EN MEMOIRE (pas de round-trip)", async () => {
    let maintenant = new Date("2026-06-12T10:00:00Z");
    const { queries } = fakeQueries();
    const store = creerNeonAutoRenameLogStore(queries, {
      capaciteParGuild: 50,
      now: () => maintenant,
    });
    await store.record(entree({ outcome: "echec" }));
    await store.record(entree({ outcome: "echec" }));
    await store.record(entree({ outcome: "succes" }));
    expect(store.failuresToday()).toBe(2);
  });
});
