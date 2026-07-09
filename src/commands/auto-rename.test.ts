/**
 * Test d'acceptation de /auto-rename (B8, ADR-0005).
 *
 * Commande ADMIN (ManageGuild) de config auto-rename PAR SERVEUR, persistee via le
 * port MappingStore (injecte ici par un fake en memoire). Sous-commandes :
 *  - add    : option ROLE native + option style (choix natifs depuis STYLE_NAMES).
 *  - remove : option ROLE.
 *  - list   : mappings de la guild avec apercu de style (apercuStyle, derive domaine).
 *
 * Refus PROPRE (ephemeral) si l'appelant n'a pas ManageGuild (defense en profondeur,
 * en plus de default_member_permissions). Mock Discord A LA FRONTIERE uniquement ;
 * le store est un fake (pas de DB).
 */
import { describe, expect, it } from "bun:test";
import { PermissionFlagsBits } from "discord.js";
import type { MappingRoleStyle } from "../domain/auto-rename";
import type { StyleName } from "../domain/styles";
import type { MappingStore } from "../mapping/store";
import type { AutoRenameLogStore } from "../auto-rename-log/store";
import type { AutoRenameLogEntry } from "../domain/auto-rename-log";
import { creerAutoRenameCommand } from "./auto-rename";

/** Store journal fake en memoire (issue #28), pour /auto-rename log. */
function fakeLogStore(entrees: AutoRenameLogEntry[] = []): AutoRenameLogStore {
  return {
    record: (e) => {
      entrees.push(e);
      return Promise.resolve();
    },
    recent: (g, n) =>
      Promise.resolve(
        entrees
          .filter((e) => e.guildId === g)
          .toSorted((a, b) => b.at.getTime() - a.at.getTime())
          .slice(0, n),
      ),
    failuresToday: () => entrees.filter((e) => e.outcome === "echec").length,
  };
}

/** Raccourci : fabrique la commande avec un journal optionnel. */
function commande(store: MappingStore, log: AutoRenameLogStore = fakeLogStore()) {
  return creerAutoRenameCommand(store, log);
}

/** Store fake en memoire, par guild, pour observer les ecritures. */
function fakeStore(initial: Record<string, MappingRoleStyle> = {}): MappingStore {
  const data = new Map<string, MappingRoleStyle>(
    Object.entries(initial).map(([g, m]) => [g, { ...m }]),
  );
  return {
    styleForRole: (g, r) => Promise.resolve(data.get(g)?.[r] ?? null),
    add: (g, r, s) => {
      data.set(g, { ...data.get(g), [r]: s });
      return Promise.resolve();
    },
    remove: (g, r) => {
      const m = { ...data.get(g) };
      delete m[r];
      data.set(g, m);
      return Promise.resolve();
    },
    list: (g) => Promise.resolve({ ...data.get(g) }),
  };
}

interface Scenario {
  sub: "add" | "remove" | "list" | "log";
  canManageGuild?: boolean;
  guildId?: string | null;
  roleId?: string;
  roleName?: string;
  style?: string;
  /** Position du role cible (#29 faisabilite). */
  rolePosition?: number;
  /** Le bot a-t-il Manage Nicknames ? (#29 faisabilite). */
  botManageNicknames?: boolean;
  /** Position du role le plus haut du bot (#29 faisabilite). */
  botRolePosition?: number;
}

interface Captured {
  content: string;
  ephemeral: boolean;
  embeds: Array<{
    data: { fields?: Array<{ name: string; value: string }>; description?: string };
  }>;
}

function fakeInteraction(s: Scenario) {
  const captured: Captured = { content: "", ephemeral: false, embeds: [] };
  const botMembre = {
    permissions: {
      has: (perm: bigint) =>
        perm === PermissionFlagsBits.ManageNicknames ? (s.botManageNicknames ?? true) : false,
    },
    roles: { highest: { position: s.botRolePosition ?? 100 } },
  };
  const interaction = {
    guildId: s.guildId === undefined ? "guild-1" : s.guildId,
    guild: { members: { me: botMembre } },
    memberPermissions: {
      has: (perm: bigint) =>
        perm === PermissionFlagsBits.ManageGuild ? (s.canManageGuild ?? true) : false,
    },
    options: {
      getSubcommand: () => s.sub,
      getRole: (_name: string, _req?: boolean) =>
        s.roleId
          ? {
              id: s.roleId,
              name: s.roleName ?? "Role",
              position: s.rolePosition ?? 1,
              toString: () => `<@&${s.roleId}>`,
            }
          : null,
      getString: (_name: string, _req?: boolean) => s.style ?? null,
      getInteger: (_name: string, _req?: boolean) => null,
    },
    reply: (payload: { content?: string; ephemeral?: boolean; embeds?: unknown[] }) => {
      captured.content = payload.content ?? "";
      captured.ephemeral = payload.ephemeral ?? false;
      captured.embeds = (payload.embeds as never) ?? [];
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

describe("commande /auto-rename", () => {
  it('se nomme "auto-rename", a une description et exige ManageGuild', () => {
    const cmd = commande(fakeStore());
    expect(cmd.data.name).toBe("auto-rename");
    expect(cmd.data.description.length).toBeGreaterThan(0);
    const json = cmd.data.toJSON();
    expect(json.default_member_permissions).toBe(PermissionFlagsBits.ManageGuild.toString());
  });

  it("expose les sous-commandes add / remove / list / log", () => {
    const json = commande(fakeStore()).data.toJSON();
    const noms = (json.options ?? []).map((o) => o.name).toSorted();
    expect(noms).toEqual(["add", "list", "log", "remove"]);
  });

  it("add expose une option ROLE et une option style avec les 9 choix du domaine", () => {
    const json = commande(fakeStore()).data.toJSON();
    const add = (json.options ?? []).find((o) => o.name === "add") as {
      options?: Array<{ name: string; type: number; choices?: Array<{ value: string }> }>;
    };
    const role = add.options?.find((o) => o.name === "role");
    const style = add.options?.find((o) => o.name === "style");
    expect(role?.type).toBe(8); // ApplicationCommandOptionType.Role
    expect(style?.choices?.length).toBe(9);
  });

  it("non-admin -> refus PROPRE ephemeral, AUCUNE ecriture", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({
      sub: "add",
      canManageGuild: false,
      roleId: "r1",
      style: "cursive",
    });
    await commande(store).execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("permission");
    expect(await store.list("guild-1")).toEqual({});
  });

  it("hors serveur (guildId null) -> refus ephemeral", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({ sub: "list", guildId: null });
    await commande(store).execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("serveur");
  });

  it("add persiste le mapping (guild, role) -> style et confirme", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({
      sub: "add",
      roleId: "role-42",
      style: "cursive",
      roleName: "VIP",
    });
    await commande(store).execute(interaction);
    expect(await store.styleForRole("guild-1", "role-42")).toBe("cursive");
    expect(captured.ephemeral).toBe(true); // reponse de config = discrete
    expect(captured.content + JSON.stringify(captured.embeds)).toMatch(/cursive|VIP/i);
  });

  it("add avec style inconnu -> refus propre, AUCUNE ecriture", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({
      sub: "add",
      roleId: "r1",
      style: "inexistant",
    });
    await commande(store).execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("inconnu");
    expect(await store.list("guild-1")).toEqual({});
  });

  it("add avec role trop haut -> mapping PERSISTE quand meme + alerte de faisabilite (#29)", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({
      sub: "add",
      roleId: "role-haut",
      style: "cursive",
      botRolePosition: 5,
      rolePosition: 10, // cible au-dessus du bot
    });
    await commande(store).execute(interaction);
    // Pas de blocage : le mapping est bien enregistre.
    expect(await store.styleForRole("guild-1", "role-haut")).toBe("cursive");
    // Mais l'admin est prevenu.
    const texte = captured.content + JSON.stringify(captured.embeds);
    expect(texte).toContain("⚠️");
    expect(texte.toLowerCase()).toContain("au-dessus");
  });

  it("add sans Manage Nicknames -> mapping PERSISTE + alerte permission (#29)", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({
      sub: "add",
      roleId: "role-x",
      style: "cursive",
      botManageNicknames: false,
    });
    await commande(store).execute(interaction);
    expect(await store.styleForRole("guild-1", "role-x")).toBe("cursive");
    const texte = captured.content + JSON.stringify(captured.embeds);
    expect(texte).toContain("⚠️");
    expect(texte.toLowerCase()).toContain("pseudos");
  });

  it("add quand le bot peut renommer -> PAS d’alerte de faisabilite (#29)", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({
      sub: "add",
      roleId: "role-ok",
      style: "cursive",
      botManageNicknames: true,
      botRolePosition: 100,
      rolePosition: 1,
    });
    await commande(store).execute(interaction);
    expect(await store.styleForRole("guild-1", "role-ok")).toBe("cursive");
    const texte = captured.content + JSON.stringify(captured.embeds);
    expect(texte).not.toContain("⚠️");
  });

  it("remove retire le mapping du role et confirme", async () => {
    const store = fakeStore({ "guild-1": { "role-42": "cursive" as StyleName } });
    const { interaction } = fakeInteraction({ sub: "remove", roleId: "role-42" });
    await commande(store).execute(interaction);
    expect(await store.list("guild-1")).toEqual({});
  });

  it("list affiche les mappings de la guild avec un apercu de style", async () => {
    const store = fakeStore({
      "guild-1": { "role-1": "cursive" as StyleName, "role-2": "gothique" as StyleName },
    });
    const { interaction, captured } = fakeInteraction({ sub: "list" });
    await commande(store).execute(interaction);
    const texte =
      (captured.embeds[0]?.data.fields ?? []).map((f) => `${f.name} ${f.value}`).join("\n") +
      (captured.embeds[0]?.data.description ?? "");
    expect(texte).toContain("role-1");
    expect(texte).toContain("role-2");
    // Apercu DERIVE du domaine (cursive de "ReNamio") -> 1er glyphe cursive present.
    expect(texte).toContain("\u{1d4e1}"); // R cursive
  });

  it("list sans mapping -> message aucun mapping (pas une erreur)", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({ sub: "list" });
    await commande(store).execute(interaction);
    const texte = captured.content + JSON.stringify(captured.embeds);
    expect(texte.toLowerCase()).toMatch(/aucun|vide|pas de/);
  });

  it("log affiche les derniers evenements du journal de la guild (issue #28)", async () => {
    const journal: AutoRenameLogEntry[] = [
      {
        guildId: "guild-1",
        memberId: "m1",
        style: "cursive" as StyleName,
        outcome: "succes",
        detail: "𝓑𝓸𝓫",
        at: new Date("2026-06-12T10:00:00Z"),
      },
      {
        guildId: "guild-1",
        memberId: "m2",
        style: "gothique" as StyleName,
        outcome: "echec",
        detail: "Hiérarchie de rôles",
        at: new Date("2026-06-12T11:00:00Z"),
      },
    ];
    const { interaction, captured } = fakeInteraction({ sub: "log" });
    await commande(fakeStore(), fakeLogStore(journal)).execute(interaction);
    expect(captured.ephemeral).toBe(true); // diagnostic = discret
    const texte =
      (captured.embeds[0]?.data.fields ?? []).map((f) => `${f.name} ${f.value}`).join("\n") +
      (captured.embeds[0]?.data.description ?? "") +
      captured.content;
    // Le plus recent (echec) en tete, avec la raison ; et la mention du membre.
    expect(texte).toContain("Hiérarchie");
    expect(texte).toMatch(/m2|<@m2>/);
  });

  it("log sans evenement -> message journal vide (pas une erreur)", async () => {
    const { interaction, captured } = fakeInteraction({ sub: "log" });
    await commande(fakeStore(), fakeLogStore([])).execute(interaction);
    const texte = captured.content + JSON.stringify(captured.embeds);
    expect(texte.toLowerCase()).toMatch(/aucun|vide|rien/);
  });

  it("log exige ManageGuild (refus propre sinon)", async () => {
    const { interaction, captured } = fakeInteraction({ sub: "log", canManageGuild: false });
    await commande(fakeStore(), fakeLogStore([])).execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("permission");
  });
});
