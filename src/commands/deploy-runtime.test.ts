/**
 * Logique partagee de deploiement des slash-commands (#40).
 *
 * On teste la PARTIE PURE : le choix du scope (global vs guild selon DISCORD_GUILD_ID)
 * et la purge des doublons en prod. Le client REST est MOCKE (port RestPutClient) :
 * aucun reseau Discord. On observe les routes et bodies passes a `put`.
 */
import { describe, expect, it } from "bun:test";
import { Routes } from "discord.js";
import { deployApplicationCommands, type RestPutClient } from "./deploy-runtime";

const APP = "111111111111111111";
const GUILD = "222222222222222222";

interface AppelPut {
  route: string;
  body: unknown;
}

function creerRestMock(opts: { echouerSur?: (route: string) => boolean } = {}): {
  rest: RestPutClient;
  appels: AppelPut[];
} {
  const appels: AppelPut[] = [];
  const rest: RestPutClient = {
    put(route, options) {
      appels.push({ route, body: options?.body });
      if (opts.echouerSur?.(route)) {
        return Promise.reject(new Error(`boom ${route}`));
      }
      return Promise.resolve({});
    },
  };
  return { rest, appels };
}

const payload = [{ name: "ping" }, { name: "styles" }];

describe("deployApplicationCommands — choix du scope (#40)", () => {
  it("mode DEV (guildId defini) : deploie GUILD-only, aucune purge", async () => {
    const { rest, appels } = creerRestMock();

    await deployApplicationCommands({
      rest,
      applicationId: APP,
      guildId: GUILD,
      payload,
      guildIds: [GUILD, "333333333333333333"],
    });

    expect(appels).toHaveLength(1);
    expect(appels[0]!.route).toBe(Routes.applicationGuildCommands(APP, GUILD));
    expect(appels[0]!.body).toEqual(payload);
  });

  it("mode PROD (pas de guildId) : deploie GLOBAL puis purge chaque guilde (PUT [])", async () => {
    const { rest, appels } = creerRestMock();
    const guildIds = [GUILD, "333333333333333333"];

    await deployApplicationCommands({
      rest,
      applicationId: APP,
      guildId: undefined,
      payload,
      guildIds,
    });

    expect(appels[0]!.route).toBe(Routes.applicationCommands(APP));
    expect(appels[0]!.body).toEqual(payload);

    const purges = appels.slice(1);
    expect(purges).toHaveLength(guildIds.length);
    for (const p of purges) {
      expect(p.body).toEqual([]);
    }
    expect(purges.map((p) => p.route).toSorted()).toEqual(
      guildIds.map((g) => Routes.applicationGuildCommands(APP, g)).toSorted(),
    );
  });

  it("mode PROD sans guildes connues : deploie global, aucune purge", async () => {
    const { rest, appels } = creerRestMock();

    await deployApplicationCommands({
      rest,
      applicationId: APP,
      guildId: undefined,
      payload,
      guildIds: [],
    });

    expect(appels).toHaveLength(1);
    expect(appels[0]!.route).toBe(Routes.applicationCommands(APP));
  });

  it("une purge de guilde qui echoue ne bloque pas les autres ni le deploiement", async () => {
    const routeEchec = Routes.applicationGuildCommands(APP, GUILD);
    const { rest, appels } = creerRestMock({ echouerSur: (r) => r === routeEchec });
    const guildIds = [GUILD, "333333333333333333"];

    // Ne doit pas rejeter malgre l'echec d'une guilde (Promise.allSettled).
    await deployApplicationCommands({
      rest,
      applicationId: APP,
      guildId: undefined,
      payload,
      guildIds,
    });

    expect(appels[0]!.route).toBe(Routes.applicationCommands(APP));
    expect(appels.slice(1)).toHaveLength(guildIds.length);
  });
});
