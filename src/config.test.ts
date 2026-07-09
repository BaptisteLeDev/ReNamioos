/**
 * Durcissement de la configuration au boot (issue #37, SEC-001 / SEC-003).
 *
 * SEC-001 (CWE-306/200) DENY-BY-DEFAULT (#43) : un bind NON-loopback SANS token REFUSE
 * le boot. L'ouverture de /stats sur le reseau dark Dokploy (prive, aucun port public)
 * exige un OPT-IN EXPLICITE : ALLOW_OPEN_STATS_ON_PRIVATE_NETWORK=true => la config
 * AVERTIT (console.warn) puis BOOTE. Sur loopback, le token reste optionnel (retro-compat
 * dev). SEC-003 : si fourni, STATS_TOKEN doit faire >= 32 octets (refus du boot).
 *
 * On valide la POLITIQUE pure (loadConfig), sans I/O : provenance de la config
 * centralisee dans un seul module (mandat ARCHITECTURE.md).
 */
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { loadConfig } from "./config";

const baseEnv = {
  DISCORD_TOKEN: "token-discord",
  DISCORD_APPLICATION_ID: "app-id",
  NODE_ENV: "production",
} as const;

const token32 = "a".repeat(32);

describe("config — bind & token /stats (issue #43, deny-by-default + opt-in explicite)", () => {
  afterEach(() => {
    mock.restore();
  });

  it("defaut HOST = 127.0.0.1 (loopback, non expose)", () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.api.host).toBe("127.0.0.1");
  });

  it("REFUSE un bind non-loopback sans STATS_TOKEN ni opt-in (SEC-001 deny-by-default)", () => {
    expect(() => loadConfig({ ...baseEnv, HOST: "0.0.0.0" })).toThrow(/SEC-001/);
  });

  it("BOOTE + WARN sur un bind non-loopback sans token AVEC opt-in explicite (reseau dark D4)", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const config = loadConfig({
      ...baseEnv,
      HOST: "0.0.0.0",
      ALLOW_OPEN_STATS_ON_PRIVATE_NETWORK: "true",
    });
    expect(config.api.host).toBe("0.0.0.0");
    expect(config.api.statsToken).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("SEC-001");
  });

  it('REFUSE un bind non-loopback sans token meme avec un opt-in non-"true" (ex: "1")', () => {
    expect(() =>
      loadConfig({ ...baseEnv, HOST: "0.0.0.0", ALLOW_OPEN_STATS_ON_PRIVATE_NETWORK: "1" }),
    ).toThrow(/SEC-001/);
  });

  it("un STATS_TOKEN valide gate /stats sans avertissement, opt-in inutile", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const config = loadConfig({ ...baseEnv, HOST: "0.0.0.0", STATS_TOKEN: token32 });
    expect(config.api.statsToken).toBe(token32);
    expect(warn).not.toHaveBeenCalled();
  });

  it("n'avertit PAS sur loopback sans token (inchangé)", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    loadConfig({ ...baseEnv, HOST: "127.0.0.1" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("REFUSE un bind non-loopback avec STATS_TOKEN < 32 octets (SEC-003)", () => {
    expect(() => loadConfig({ ...baseEnv, HOST: "0.0.0.0", STATS_TOKEN: "court" })).toThrow();
  });

  it("ACCEPTE un bind non-loopback avec STATS_TOKEN >= 32 octets (/stats gate par Bearer)", () => {
    const config = loadConfig({ ...baseEnv, HOST: "0.0.0.0", STATS_TOKEN: token32 });
    expect(config.api.host).toBe("0.0.0.0");
    expect(config.api.statsToken).toBe(token32);
  });

  it("ACCEPTE un bind loopback sans token (retro-compat dev)", () => {
    const config = loadConfig({ ...baseEnv, HOST: "127.0.0.1" });
    expect(config.api.statsToken).toBeUndefined();
  });

  it("REFUSE un STATS_TOKEN < 32 octets meme sur loopback (SEC-003)", () => {
    expect(() => loadConfig({ ...baseEnv, HOST: "127.0.0.1", STATS_TOKEN: "court" })).toThrow();
  });

  it("traite ::1 comme loopback (IPv6)", () => {
    const config = loadConfig({ ...baseEnv, HOST: "::1" });
    expect(config.api.host).toBe("::1");
  });
});

describe("config — auto-deploiement des commandes (#40)", () => {
  it("DEFAUT true quand DISCORD_AUTO_DEPLOY_COMMANDS est absent", () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.discord.autoDeployCommands).toBe(true);
  });

  it("seul 'false' (insensible a la casse) desactive", () => {
    expect(
      loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: "false" }).discord.autoDeployCommands,
    ).toBe(false);
    expect(
      loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: "FALSE" }).discord.autoDeployCommands,
    ).toBe(false);
  });

  it("toute autre valeur ('true', '1', vide) reste activee", () => {
    expect(
      loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: "true" }).discord.autoDeployCommands,
    ).toBe(true);
    expect(
      loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: "1" }).discord.autoDeployCommands,
    ).toBe(true);
    expect(
      loadConfig({ ...baseEnv, DISCORD_AUTO_DEPLOY_COMMANDS: "" }).discord.autoDeployCommands,
    ).toBe(true);
  });
});
