/**
 * Test du FileCommandSyncStore (mode dev) sur une I/O fichier FAKE (en memoire).
 * Verifie le round-trip getKnown/record et la tolerance au fichier absent/corrompu.
 */
import { describe, expect, it } from "bun:test";
import { creerFileCommandSyncStore, type FileIo } from "./file-store";

function fakeIo(initial: string | null = null): FileIo {
  let contenu = initial;
  return {
    read: () => Promise.resolve(contenu),
    write: (c) => {
      contenu = c;
      return Promise.resolve();
    },
  };
}

describe("FileCommandSyncStore", () => {
  it("renvoie [] quand le fichier est absent", async () => {
    const store = creerFileCommandSyncStore(fakeIo(null));
    expect(await store.getKnown("g1")).toEqual([]);
  });

  it("persiste et relit l’instantane par serveur", async () => {
    const io = fakeIo(null);
    const store = creerFileCommandSyncStore(io);
    await store.record("g1", ["ping", "update"]);
    expect(await store.getKnown("g1")).toEqual(["ping", "update"]);
  });

  it("isole les serveurs (cle = guildId)", async () => {
    const store = creerFileCommandSyncStore(fakeIo(null));
    await store.record("g1", ["ping"]);
    await store.record("g2", ["aide"]);
    expect(await store.getKnown("g1")).toEqual(["ping"]);
    expect(await store.getKnown("g2")).toEqual(["aide"]);
  });

  it("tolere un JSON corrompu (renvoie [])", async () => {
    const store = creerFileCommandSyncStore(fakeIo("{pas du json"));
    expect(await store.getKnown("g1")).toEqual([]);
  });
});
