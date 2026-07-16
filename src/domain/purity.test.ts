/**
 * Test de fitness "domaine pur" (socle de flotte, cf. ARCHITECTURE.md).
 *
 * L'invariant hexagonal de ReNamioos (src/domain/README.md) devient executable :
 * aucun fichier de src/domain/ ne doit importer discord.js, Fastify, fs, process,
 * pg ou drizzle. Le test echoue en nommant le fichier fautif et l'import en cause.
 *
 * Les tests colocalises (*.test.ts) sont exclus du scan : ce fichier lui-meme lit le
 * disque (node:fs) pour scanner le domaine.
 *
 * LIMITE (assumee) : le scan est LEXICAL et DIRECT. Il garantit qu'aucun fichier du
 * domaine n'importe DIRECTEMENT un module interdit, PAS la cloture transitive. On
 * accepte ce compromis : le domaine n'a pas de dependance interne vers l'infra par
 * construction, et un scan transitif ajouterait une complexite disproportionnee.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DOMAINE = import.meta.dir;

// Un import est interdit s'il designe exactement l'un de ces modules ou un sous-chemin
// (ex. "fs/promises", "drizzle-orm/pg-core", "@fastify/cors").
const MODULES_INTERDITS = [
  "discord.js",
  "@discordjs",
  "fastify",
  "@fastify",
  "fs",
  "node:fs",
  "process",
  "node:process",
  "pg",
  "drizzle-orm",
];

function fichiersDuDomaine(dossier: string): string[] {
  return readdirSync(dossier, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(dossier, f));
}

function importsDe(source: string): string[] {
  const motif = /\b(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g;
  return [...source.matchAll(motif)].map(([, spec]) => spec as string);
}

function estInterdit(spec: string): boolean {
  return MODULES_INTERDITS.some((m) => spec === m || spec.startsWith(`${m}/`));
}

describe("domaine pur", () => {
  it("aucun fichier de src/domain n'importe discord.js, fastify, fs, process, pg ou drizzle", () => {
    const fautifs: string[] = [];
    for (const fichier of fichiersDuDomaine(DOMAINE)) {
      for (const spec of importsDe(readFileSync(fichier, "utf8"))) {
        if (estInterdit(spec)) fautifs.push(`${fichier} → import "${spec}"`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
