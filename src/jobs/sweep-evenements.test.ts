/**
 * Test du balayage de nettoyage des events echus (« Style Party »). Les pseudos sont revertis
 * par le sweep-temporaire (echeances memorisees) ; ce balayage COMPLEMENTAIRE supprime la LIGNE
 * d'event echue (minimisation D8), pour qu'une guilde puisse en relancer un et que la table reste
 * minuscule.
 */
import { describe, expect, it } from "bun:test";
import { creerMemoryEventStore } from "../event/memory-store";
import { nettoyerEvenementsExpires } from "./sweep-evenements";

const evt = (guildId: string, expiresAt: number) => ({
  guildId,
  roleId: "r1",
  style: "gothique" as const,
  startedAt: 1000,
  expiresAt,
});

describe("nettoyerEvenementsExpires", () => {
  it("supprime les events echus et renvoie leur nombre", async () => {
    const store = creerMemoryEventStore();
    await store.demarrer(evt("g1", 5000), 1000);
    await store.demarrer(evt("g2", 50000), 1000);
    const supprimes = await nettoyerEvenementsExpires(store, 6000);
    expect(supprimes).toBe(1);
    expect(await store.getActif("g1", 6000)).toBeNull();
    expect(await store.getActif("g2", 6000)).toMatchObject({ roleId: "r1" });
  });

  it("aucun event echu -> 0, ne touche a rien", async () => {
    const store = creerMemoryEventStore();
    await store.demarrer(evt("g1", 50000), 1000);
    expect(await nettoyerEvenementsExpires(store, 6000)).toBe(0);
  });
});
