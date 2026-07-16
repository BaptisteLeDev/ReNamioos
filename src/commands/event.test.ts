/**
 * Test d'acceptation de la « Style Party » (/event start|stop|status).
 *
 * ORCHESTRATION (demarrerEvenement/arreterEvenement) testee sans discord.js : membres factices
 * a la frontiere. Verifie l'invariant (un seul event), le respect STRICT de l'opt-out, l'exclusion
 * des bots et des membres non manageables, la memorisation d'echeance (revert auto via sweep), le
 * debit borne (sequentiel), et le revert a l'arret. Le COMMAND-level verifie les gardes admin.
 */
import { describe, expect, it } from "bun:test";
import { PermissionFlagsBits, ApplicationCommandOptionType } from "discord.js";
import { demarrerEvenement, arreterEvenement, creerEventCommand, type DepsEvent } from "./event";
import { creerMemoryEventStore } from "../event/memory-store";
import { creerMemoryOptOutStore } from "../optout/memory-store";
import { creerMemoryOriginalNickStore } from "../original-nick/memory-store";
import { creerMemoryGuildSettingsStore } from "../guildsettings/memory-store";
import { creerEmbedFactory } from "../theming/embed";
import { THEME_RENAMIOOS } from "../theming/theme";
import type { OptOutStore } from "../optout/store";

const socle = () =>
  [creerMemoryGuildSettingsStore(), creerEmbedFactory(THEME_RENAMIOOS)] as const;

interface Editions {
  [memberId: string]: string | null | undefined;
}

function fakeMembre(
  o: {
    id: string;
    manageable?: boolean;
    bot?: boolean;
    nickname?: string | null;
    username?: string;
  },
  edits: Editions,
) {
  return {
    id: o.id,
    guild: { id: "g1" },
    manageable: o.manageable ?? true,
    nickname: o.nickname ?? null,
    user: { username: o.username ?? "Bob", bot: o.bot ?? false },
    edit: (data: { nick?: string | null }) => {
      edits[o.id] = data.nick;
      return Promise.resolve();
    },
  } as never;
}

function deps(optOut: OptOutStore = creerMemoryOptOutStore()): DepsEvent {
  return {
    eventStore: creerMemoryEventStore(),
    optOutStore: optOut,
    originalNickStore: creerMemoryOriginalNickStore(),
    attendre: () => Promise.resolve(),
  };
}

const T0 = 1_000_000;
const EXPIRE = T0 + 3_600_000;

describe("demarrerEvenement — Style Party", () => {
  it("stylise les membres eligibles, IGNORE bots / non-manageables / opt-out", async () => {
    const edits: Editions = {};
    const optOut = creerMemoryOptOutStore();
    await optOut.optOut("g1", "m-optout");
    const d = deps(optOut);
    const membres = [
      fakeMembre({ id: "m-ok", nickname: "Alice" }, edits),
      fakeMembre({ id: "m-bot", bot: true }, edits),
      fakeMembre({ id: "m-haut", manageable: false }, edits),
      fakeMembre({ id: "m-optout", nickname: "Carol" }, edits),
    ];
    const res = await demarrerEvenement(d, {
      guildId: "g1",
      roleId: "r1",
      style: "gothique",
      startedAt: T0,
      expiresAt: EXPIRE,
      membres,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.resume).toEqual({ stylises: 1, ignores: 3, echecs: 0 });
    }
    // Seul m-ok est edite ; bot / hierarchie / opt-out intacts.
    expect(edits["m-ok"]).toBeDefined();
    expect(edits["m-bot"]).toBeUndefined();
    expect(edits["m-haut"]).toBeUndefined();
    expect(edits["m-optout"]).toBeUndefined();
  });

  it("MEMORISE l echeance pour le revert auto (sweep-temporaire)", async () => {
    const edits: Editions = {};
    const d = deps();
    await demarrerEvenement(d, {
      guildId: "g1",
      roleId: "r1",
      style: "gothique",
      startedAt: T0,
      expiresAt: EXPIRE,
      membres: [fakeMembre({ id: "m-ok", nickname: "Alice" }, edits)],
    });
    // L'echeance est due APRES expiration -> le job sweep-temporaire la restaurera.
    const dus = await d.originalNickStore.listDue(EXPIRE + 1);
    expect(dus.map((x) => x.memberId)).toContain("m-ok");
    expect(await d.eventStore.getActif("g1", T0 + 1)).toMatchObject({ style: "gothique" });
  });

  it("INTERDIT un 2e event simultane (invariant d agrégat)", async () => {
    const edits: Editions = {};
    const d = deps();
    const params = {
      guildId: "g1",
      roleId: "r1",
      style: "gothique" as const,
      startedAt: T0,
      expiresAt: EXPIRE,
      membres: [fakeMembre({ id: "m-ok" }, edits)],
    };
    expect((await demarrerEvenement(d, params)).ok).toBe(true);
    const deuxieme = await demarrerEvenement(d, { ...params, style: "cursive" as const });
    expect(deuxieme.ok).toBe(false);
    if (!deuxieme.ok) expect(deuxieme.raison).toBe("deja-en-cours");
  });
});

describe("arreterEvenement — revert immediat", () => {
  it("restaure les pseudos memorises et supprime l event", async () => {
    const edits: Editions = {};
    const d = deps();
    const membre = fakeMembre({ id: "m-ok", nickname: "Alice" }, edits);
    await demarrerEvenement(d, {
      guildId: "g1",
      roleId: "r1",
      style: "gothique",
      startedAt: T0,
      expiresAt: EXPIRE,
      membres: [membre],
    });

    const res = await arreterEvenement(d, { guildId: "g1", membres: [membre] });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.reverts).toBe(1);
    // Apres l'arret, le dernier edit repose le pseudo d'origine (revert immediat).
    expect(edits["m-ok"]).toBe("Alice");
    expect(await d.eventStore.getActif("g1", T0 + 1)).toBeNull();
    expect(await d.originalNickStore.get("g1", "m-ok")).toBeNull(); // oublie (D8)
  });

  it("aucun event actif -> ok:false", async () => {
    const res = await arreterEvenement(deps(), { guildId: "g1", membres: [] });
    expect(res.ok).toBe(false);
  });
});

describe("commande /event — schema & gardes admin", () => {
  it("expose start/stop/status et exige Manage Server", () => {
    const json = creerEventCommand(deps(), ...socle()).data.toJSON();
    const noms = (json.options ?? []).map((o) => o.name).toSorted();
    expect(noms).toEqual(["start", "status", "stop"]);
    expect(json.default_member_permissions).toBe(String(PermissionFlagsBits.ManageGuild));
  });

  it("start declare les options style / duree / role", () => {
    const json = creerEventCommand(deps(), ...socle()).data.toJSON();
    const start = (json.options ?? []).find((o) => o.name === "start") as {
      options?: { name: string; type: number }[];
    };
    const opts = (start.options ?? []).map((o) => o.name).toSorted();
    expect(opts).toEqual(["duree", "role", "style"]);
    const role = (start.options ?? []).find((o) => o.name === "role");
    expect(role?.type).toBe(ApplicationCommandOptionType.Role);
  });

  it("propose l autocomplete du style", () => {
    expect(typeof creerEventCommand(deps(), ...socle()).autocomplete).toBe("function");
  });
});
