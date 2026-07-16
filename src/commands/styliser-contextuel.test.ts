/**
 * Test d'acceptation du menu contextuel MEMBRE -> « Styliser » (proposition ReNamioos, axe UX).
 *
 * Clic droit sur un membre -> Apps -> reponse EPHEMERE avec un select des 9 styles (apercu du
 * pseudo dans chaque). Selection -> appliquerRename (hierarchie + domaine + troncature + edit).
 * Permission Manage Nicknames requise (copiee de /rename), revalidee au select (defense en
 * profondeur). Le select est desactive apres application (finalisation). Mock Discord a la
 * frontiere ; le flux metier (appliquerRename) reste le flux PARTAGE, sans duplication.
 */
import { describe, expect, it } from "bun:test";
import { ApplicationCommandType, PermissionFlagsBits } from "discord.js";
import {
  creerStyliserContextuelCommand,
  creerGestionnaireStyliser,
  PREFIXE_STYLISER,
  customIdStyliser,
  parseCustomIdStyliser,
} from "./styliser-contextuel";
import { creerMemoryGuildSettingsStore } from "../guildsettings/memory-store";
import { creerEmbedFactory } from "../theming/embed";
import { THEME_RENAMIOOS } from "../theming/theme";

interface Captured {
  embeds: { data: { title?: string; fields?: { name: string; value: string }[] } }[];
  components: { toJSON: () => { components: { disabled?: boolean }[] } }[];
  content: string;
  ephemeral: boolean;
  updated: boolean;
  editNick?: string | null;
}

function cmd() {
  return creerStyliserContextuelCommand(creerMemoryGuildSettingsStore());
}

function handler() {
  return creerGestionnaireStyliser(
    creerMemoryGuildSettingsStore(),
    creerEmbedFactory(THEME_RENAMIOOS),
  );
}

/** Double : menu contextuel membre. `peutGerer` = l'appelant a Manage Nicknames. */
function fakeUserMenu(opts: { peutGerer?: boolean; memberId?: string; username?: string }) {
  const captured: Captured = {
    embeds: [],
    components: [],
    content: "",
    ephemeral: false,
    updated: false,
  };
  const interaction = {
    guildId: "g1",
    guild: { preferredLocale: "fr" },
    locale: "fr",
    targetId: opts.memberId ?? "m-1",
    targetUser: { id: opts.memberId ?? "m-1", username: opts.username ?? "Bob" },
    isUserContextMenuCommand: () => true,
    memberPermissions: { has: (_p: bigint) => opts.peutGerer ?? true },
    reply: (payload: {
      embeds?: never[];
      components?: never[];
      content?: string;
      ephemeral?: boolean;
    }) => {
      captured.embeds = (payload.embeds ?? []) as never;
      captured.components = (payload.components ?? []) as never;
      captured.content = payload.content ?? "";
      captured.ephemeral = payload.ephemeral ?? false;
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

/** Double : select de style. `manageable`/`membreAbsent` pilotent le membre a renommer. */
function fakeSelectStyliser(opts: {
  style: string;
  memberId?: string;
  peutGerer?: boolean;
  manageable?: boolean;
  membreAbsent?: boolean;
  nickname?: string;
}) {
  const captured: Captured = {
    embeds: [],
    components: [],
    content: "",
    ephemeral: false,
    updated: false,
  };
  const membre = {
    id: opts.memberId ?? "m-1",
    manageable: opts.manageable ?? true,
    nickname: opts.nickname ?? "Bob",
    user: { username: opts.nickname ?? "Bob" },
    toString: () => `<@${opts.memberId ?? "m-1"}>`,
    edit: (data: { nick?: string | null }) => {
      captured.editNick = data.nick ?? null;
      return Promise.resolve();
    },
  };
  const interaction = {
    guildId: "g1",
    guild: {
      preferredLocale: "fr",
      members: {
        fetch: (_id: string) =>
          opts.membreAbsent
            ? Promise.reject(new Error("Unknown Member"))
            : Promise.resolve(membre),
      },
    },
    locale: "fr",
    customId: customIdStyliser(opts.memberId ?? "m-1"),
    values: [opts.style],
    isStringSelectMenu: () => true,
    memberPermissions: { has: (_p: bigint) => opts.peutGerer ?? true },
    update: (payload: { embeds?: never[]; components?: never[] }) => {
      captured.embeds = (payload.embeds ?? []) as never;
      captured.components = (payload.components ?? []) as never;
      captured.updated = true;
      return Promise.resolve();
    },
    reply: (payload: { content?: string; ephemeral?: boolean }) => {
      captured.content = payload.content ?? "";
      captured.ephemeral = payload.ephemeral ?? false;
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

describe("customId Styliser (stateless)", () => {
  it("encode et re-decode le memberId", () => {
    const cid = customIdStyliser("m-42");
    expect(cid.startsWith(PREFIXE_STYLISER)).toBe(true);
    expect(parseCustomIdStyliser(cid)).toEqual({ memberId: "m-42" });
  });
  it("renvoie null pour un customId etranger", () => {
    expect(parseCustomIdStyliser("rnm-conv:a:b")).toBeNull();
  });
});

describe("menu contextuel membre -> Styliser", () => {
  it("est une commande de type USER, avec permission Manage Nicknames", () => {
    const json = cmd().data.toJSON();
    expect(json.type).toBe(ApplicationCommandType.User);
    expect(json.default_member_permissions).toBe(String(PermissionFlagsBits.ManageNicknames));
  });

  it("repond EPHEMERE un select des 9 styles", async () => {
    const { interaction, captured } = fakeUserMenu({});
    await cmd().execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.components.length).toBeGreaterThan(0);
  });

  it("appelant sans Manage Nicknames -> refus ephemere, pas de select", async () => {
    const { interaction, captured } = fakeUserMenu({ peutGerer: false });
    await cmd().execute(interaction);
    expect(captured.content.length).toBeGreaterThan(0);
    expect(captured.components.length).toBe(0);
  });
});

describe("select de style (Styliser) -> appliquerRename", () => {
  it("applique le style au membre (edit) et confirme, select desactive", async () => {
    const { interaction, captured } = fakeSelectStyliser({ style: "gothique" });
    await handler().execute(interaction);
    expect(captured.editNick).toBeDefined();
    expect(captured.editNick).not.toBe("Bob"); // pseudo bien stylise
    expect(captured.updated).toBe(true);
    expect(captured.embeds.length).toBe(1);
    // Composants desactives apres application (finalisation).
    const row = captured.components[0];
    expect(row?.toJSON().components[0]?.disabled).toBe(true);
  });

  it("revalide Manage Nicknames au select (defense en profondeur)", async () => {
    const { interaction, captured } = fakeSelectStyliser({ style: "gothique", peutGerer: false });
    await handler().execute(interaction);
    expect(captured.editNick).toBeUndefined(); // aucun rename
    expect(captured.content.length).toBeGreaterThan(0);
  });

  it("membre non manageable (hierarchie) -> message d'echec, aucun edit reussi", async () => {
    const { interaction, captured } = fakeSelectStyliser({ style: "gothique", manageable: false });
    await handler().execute(interaction);
    expect(captured.editNick).toBeUndefined();
  });

  it("membre parti -> refus propre sans crasher", async () => {
    const { interaction, captured } = fakeSelectStyliser({ style: "gothique", membreAbsent: true });
    await handler().execute(interaction);
    expect(captured.editNick).toBeUndefined();
    expect(captured.content.length).toBeGreaterThan(0);
  });

  it("expose le bon prefixe de routage", () => {
    expect(handler().prefixe).toBe(PREFIXE_STYLISER);
  });
});
