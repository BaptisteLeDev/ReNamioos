/**
 * Test de la file a debit borne (traitement SEQUENTIEL, jamais Promise.all) : borne la pression
 * sur l'API Discord lors d'editions de pseudo en masse (Style Party). Un item a la fois, avec un
 * delai injectable entre deux. Une erreur sur un item n'interrompt PAS la file (best effort).
 */
import { describe, expect, it } from "bun:test";
import { traiterEnFile } from "./file-debit";

describe("traiterEnFile — debit borne, sequentiel", () => {
  it("traite TOUS les items, dans l ordre", async () => {
    const vus: number[] = [];
    const res = await traiterEnFile([1, 2, 3], (n) => {
      vus.push(n);
      return Promise.resolve();
    });
    expect(vus).toEqual([1, 2, 3]);
    expect(res.traites).toBe(3);
  });

  it("n execute JAMAIS deux traitements en parallele (concurrence max = 1)", async () => {
    let enCours = 0;
    let maxConcurrent = 0;
    await traiterEnFile([1, 2, 3, 4], async () => {
      enCours += 1;
      maxConcurrent = Math.max(maxConcurrent, enCours);
      await Promise.resolve();
      enCours -= 1;
    });
    expect(maxConcurrent).toBe(1);
  });

  it("espace les traitements du delai injecte (entre les items, pas apres le dernier)", async () => {
    const attentes: number[] = [];
    await traiterEnFile([1, 2, 3], () => Promise.resolve(), {
      delaiMs: 50,
      attendre: (ms) => {
        attentes.push(ms);
        return Promise.resolve();
      },
    });
    expect(attentes).toEqual([50, 50]); // 2 attentes pour 3 items
  });

  it("une erreur sur un item n interrompt PAS la file (les suivants passent)", async () => {
    const vus: number[] = [];
    const res = await traiterEnFile([1, 2, 3], (n) => {
      vus.push(n);
      if (n === 2) return Promise.reject(new Error("boom"));
      return Promise.resolve();
    });
    expect(vus).toEqual([1, 2, 3]);
    expect(res.traites).toBe(2); // 2 succes, 1 echec
    expect(res.echecs).toBe(1);
  });
});
