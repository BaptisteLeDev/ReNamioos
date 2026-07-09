/**
 * Tests de durcissement de l'API HTTP (findings #22 CWE-306, #23 CWE-770).
 *
 * L'API ecoute par defaut sur 127.0.0.1 (loopback, non exposee — SEC-001 #37). On
 * verifie ici les garde-fous applicables des qu'un token est configure :
 *   - /stats est GATE par un token Bearer quand STATS_TOKEN est configure
 *     (401 sans token / token errone) ; ouvert si aucun token n'est defini
 *     (retro-compat mode dev).
 *   - /health reste TOUJOURS public (invariant du contrat bdf-monitor : preuve de
 *     vie independante de l'auth).
 *   - CORS : origine non autorisee refusee quand une allowlist est fournie.
 *   - Rate limit : un flot de requetes finit par recevoir 429.
 *
 * On injecte un StatsProvider factice (pas de Discord), conforme au pattern du
 * contract.test.ts voisin.
 */
import { describe, expect, it } from "bun:test";
import { createApiServer, tokenValide } from "./server";
import type { StatsProvider } from "./stats-provider";

const offlineProvider: StatsProvider = {
  getStats: () => ({
    guildCount: 0,
    userCount: 0,
    commandsToday: 0,
    autoRenameFailuresToday: 0,
    commandsDaily: [],
    discordLatencyMs: -1,
    version: "0.0.0-test",
  }),
};

describe("API /stats — authentification (finding #22, CWE-306)", () => {
  it("refuse /stats sans token quand STATS_TOKEN est configure (401)", async () => {
    const app = await createApiServer({ statsProvider: offlineProvider, statsToken: "s3cret" });
    const res = await app.inject({ method: "GET", url: "/stats" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("refuse /stats avec un mauvais token (401)", async () => {
    const app = await createApiServer({ statsProvider: offlineProvider, statsToken: "s3cret" });
    const res = await app.inject({
      method: "GET",
      url: "/stats",
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("autorise /stats avec le bon token Bearer (200)", async () => {
    const app = await createApiServer({ statsProvider: offlineProvider, statsToken: "s3cret" });
    const res = await app.inject({
      method: "GET",
      url: "/stats",
      headers: { authorization: "Bearer s3cret" },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as Record<string, unknown>)["guildCount"]).toBe(0);
    await app.close();
  });

  it("un token de longueur differente est refuse (compare en temps constant)", async () => {
    const app = await createApiServer({ statsProvider: offlineProvider, statsToken: "s3cret" });
    const res = await app.inject({
      method: "GET",
      url: "/stats",
      headers: { authorization: "Bearer s" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("sans STATS_TOKEN configure, /stats reste ouvert (retro-compat dev)", async () => {
    const app = await createApiServer({ statsProvider: offlineProvider });
    const res = await app.inject({ method: "GET", url: "/stats" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("/health reste public meme avec STATS_TOKEN (invariant contrat)", async () => {
    const app = await createApiServer({ statsProvider: offlineProvider, statsToken: "s3cret" });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe("tokenValide — comparaison constante (issue #37, SEC-004, CWE-208)", () => {
  it("vrai pour deux tokens egaux", () => {
    expect(
      tokenValide("s3cret-token-de-32-octets-aaaaaa", "s3cret-token-de-32-octets-aaaaaa"),
    ).toBe(true);
  });

  it("faux pour deux tokens de meme longueur differents", () => {
    expect(
      tokenValide("s3cret-token-de-32-octets-aaaaaa", "s3cret-token-de-32-octets-bbbbbb"),
    ).toBe(false);
  });

  it("faux pour des longueurs differentes (sans court-circuit de longueur)", () => {
    // Le pattern hash-puis-compare hashe les deux cOtes : pas de retour anticipe sur
    // la difference de longueur (anti timing-oracle SEC-004).
    expect(tokenValide("s3cret", "s")).toBe(false);
    expect(tokenValide("s", "s3cret-beaucoup-plus-long-que-lautre")).toBe(false);
  });
});

describe("API CORS — allowlist (finding #22)", () => {
  it("refuse une origine hors allowlist (pas de header allow-origin)", async () => {
    const app = await createApiServer({
      statsProvider: offlineProvider,
      corsOrigins: ["https://renamioos.app"],
    });
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("autorise une origine de l allowlist", async () => {
    const app = await createApiServer({
      statsProvider: offlineProvider,
      corsOrigins: ["https://renamioos.app"],
    });
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://renamioos.app" },
    });
    expect(res.headers["access-control-allow-origin"]).toBe("https://renamioos.app");
    await app.close();
  });
});

describe("API rate limit (finding #23, CWE-770)", () => {
  it("renvoie 429 au-dela du quota configure", async () => {
    const app = await createApiServer({
      statsProvider: offlineProvider,
      rateLimit: { max: 3, timeWindow: 60_000 },
    });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: "GET", url: "/health" });
      codes.push(res.statusCode);
    }
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    await app.close();
  });
});
