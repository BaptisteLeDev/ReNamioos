/**
 * Test du mapping d'erreur de `member.edit` (audit finding #7).
 *
 * Avant : `catch {}` aplati -> TOUTE erreur (429, reseau, 500) etait rapportee comme « pas la
 * permission » (diagnostic trompeur) et avalee sans trace. Apres : l'erreur reelle est LOGGEE ;
 * le message « permission » n'est renvoye QUE pour un DiscordAPIError 50013 (Missing
 * Permissions / hierarchie), sinon un message generique.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DiscordAPIError, type GuildMember } from "discord.js";
import { appliquerRename, restaurerPseudo } from "./styliser";

/** Membre minimal : gerable, avec un `edit` injecte (succes ou rejet). */
function fakeMembre(edit: () => Promise<void>): GuildMember {
  return { manageable: true, edit } as never;
}

/** DiscordAPIError 50013 (Missing Permissions) construit comme discord.js le ferait. */
function erreur50013(): DiscordAPIError {
  return new DiscordAPIError(
    { code: 50013, message: "Missing Permissions" },
    50013,
    403,
    "PATCH",
    "https://discord.test/x",
    { files: [], body: {} },
  );
}

let erreursLoggees: unknown[][];
const consoleErrorOriginal = console.error;
beforeEach(() => {
  erreursLoggees = [];
  console.error = (...args: unknown[]) => erreursLoggees.push(args);
});
afterEach(() => {
  console.error = consoleErrorOriginal;
});

describe("appliquerRename — mapping d'erreur de member.edit (audit #7)", () => {
  it("erreur NON-permission (reseau/429/500) -> message GENERIQUE, erreur loggee", async () => {
    const membre = fakeMembre(() => Promise.reject(new Error("ECONNRESET")));
    const r = await appliquerRename(membre, "cursive", "Bob");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.toLowerCase()).not.toContain("permission");
    expect(erreursLoggees.length).toBeGreaterThan(0); // plus de catch silencieux
  });

  it("DiscordAPIError 50013 -> message PERMISSION (mapping cible)", async () => {
    const membre = fakeMembre(() => Promise.reject(erreur50013()));
    const r = await appliquerRename(membre, "cursive", "Bob");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.toLowerCase()).toContain("permission");
  });
});

describe("restaurerPseudo — mapping d'erreur de member.edit (audit #7)", () => {
  it("erreur NON-permission -> message GENERIQUE, erreur loggee", async () => {
    const membre = fakeMembre(() => Promise.reject(new Error("boom 500")));
    const r = await restaurerPseudo(membre, "Bob");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.toLowerCase()).not.toContain("permission");
    expect(erreursLoggees.length).toBeGreaterThan(0);
  });

  it("DiscordAPIError 50013 -> message PERMISSION", async () => {
    const membre = fakeMembre(() => Promise.reject(erreur50013()));
    const r = await restaurerPseudo(membre, "Bob");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.toLowerCase()).toContain("permission");
  });
});
