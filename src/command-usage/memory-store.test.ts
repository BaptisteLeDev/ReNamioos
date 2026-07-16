/**
 * Tests de l'adapter MEMOIRE du suivi d'usage des commandes (issue #27) — mode DEV.
 *
 * Verifie l'incrementation par jour (UTC), la lecture SYNCHRONE de `commandsDaily`
 * (serie triee ascendant), et le passage d'un jour a l'autre (clock injectee).
 */
import { describe, expect, it } from "bun:test";
import { creerMemoryCommandUsageStore } from "./memory-store";

describe("MemoryCommandUsageStore", () => {
  it("commandsDaily vaut [] avant tout enregistrement", () => {
    const store = creerMemoryCommandUsageStore({ now: () => new Date("2026-06-12T10:00:00Z") });
    expect(store.commandsDaily()).toEqual([]);
  });

  it("incremente le compteur du jour courant et expose la serie (sync)", async () => {
    let maintenant = new Date("2026-06-12T10:00:00Z");
    const store = creerMemoryCommandUsageStore({ now: () => maintenant });
    await store.record();
    await store.record();
    expect(store.commandsDaily()).toEqual([{ day: "2026-06-12", count: 2 }]);
  });

  it("agrege par jour UTC et trie ascendant sur plusieurs jours", async () => {
    let maintenant = new Date("2026-06-10T10:00:00Z");
    const store = creerMemoryCommandUsageStore({ now: () => maintenant });
    await store.record(); // 2026-06-10
    maintenant = new Date("2026-06-12T08:00:00Z");
    await store.record(); // 2026-06-12
    await store.record();
    expect(store.commandsDaily()).toEqual([
      { day: "2026-06-10", count: 1 },
      { day: "2026-06-12", count: 2 },
    ]);
  });
});
