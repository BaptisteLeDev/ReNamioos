/**
 * Test d'acceptation de /rename-cancel @membre (issue #46, scenario F2).
 *
 * Annule un renommage temporaire actif : SUPPRIME la ligne de persistance ET restaure le
 * pseudo original immediatement (member.edit), avec confirmation. Membre sans renommage
 * temporaire => message clair, AUCUN effet (ni edit, ni oubli d'une ligne role-only #25).
 * Meme garde de permission (Manage Nicknames) que le reste de l'admin rename.
 */
import { describe, expect, it } from "bun:test";
import { PermissionFlagsBits } from "discord.js";
import { creerRenameCancelCommand } from "./rename-cancel";
import { creerMemoryOriginalNickStore } from "../original-nick/memory-store";
import type { OriginalNickStore } from "../original-nick/store";
import { en } from "../i18n/catalog";

interface Scenario {
  canManageNicknames?: boolean;
  manageable?: boolean;
  editThrows?: boolean;
  memberNull?: boolean;
  guildId?: string;
  store: OriginalNickStore;
  discordLocale?: string;
}

interface Captured {
  edited: string | null | undefined;
  editCalled: boolean;
  content: string;
  ephemeral: boolean;
}

function fakeInteraction(s: Scenario) {
  const captured: Captured = { edited: undefined, editCalled: false, content: "", ephemeral: false };
  const targetMember = {
    id: "m-cible",
    guild: { id: s.guildId ?? "g-test" },
    toString: () => "@cible",
    manageable: s.manageable ?? true,
    edit: (data: { nick?: string | null }) => {
      captured.editCalled = true;
      if (s.editThrows) return Promise.reject(new Error("Missing Permissions"));
      captured.edited = data.nick;
      return Promise.resolve();
    },
  };
  const interaction = {
    guildId: s.guildId ?? "g-test",
    guild: { preferredLocale: s.discordLocale ?? "fr" },
    locale: s.discordLocale ?? "fr",
    memberPermissions: {
      has: (perm: bigint) =>
        perm === PermissionFlagsBits.ManageNicknames ? (s.canManageNicknames ?? true) : false,
    },
    options: {
      getMember: () => (s.memberNull ? null : targetMember),
    },
    reply: (payload: { content?: string; ephemeral?: boolean; embeds?: unknown[] }) => {
      captured.content = payload.content ?? "";
      captured.ephemeral = payload.ephemeral ?? false;
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

describe("commande /rename-cancel", () => {
  it('se nomme "rename-cancel", exige Manage Nicknames et a une option membre requise', () => {
    const command = creerRenameCancelCommand(creerMemoryOriginalNickStore());
    expect(command.data.name).toBe("rename-cancel");
    const json = command.data.toJSON();
    expect(json.default_member_permissions).toBe(PermissionFlagsBits.ManageNicknames.toString());
    const membre = json.options?.find((o) => o.name === "membre");
    expect(membre?.required).toBe(true);
  });

  it("permission appelant manquante -> ephemere, AUCUN edit", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g-test", "m-cible", "Bob", Date.now() + 100_000);
    const command = creerRenameCancelCommand(store);
    const { interaction, captured } = fakeInteraction({ store, canManageNicknames: false });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("permission");
  });

  it("membre SANS renommage temporaire -> message clair, AUCUN edit", async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCancelCommand(store);
    const { interaction, captured } = fakeInteraction({ store });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("aucun renommage temporaire");
  });

  it("ligne role-only (#25, sans echeance) -> traitee comme AUCUN renommage temporaire, ligne conservee", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g-test", "m-cible", "RoleOnly"); // pas d echeance
    const command = creerRenameCancelCommand(store);
    const { interaction, captured } = fakeInteraction({ store });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.content.toLowerCase()).toContain("aucun renommage temporaire");
    // La ligne role-only NE doit PAS avoir ete oubliee (le round-trip par role continue).
    expect(await store.get("g-test", "m-cible")).toBe("RoleOnly");
  });

  it("renommage temporaire actif -> restaure le pseudo original, supprime la ligne, confirme", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g-test", "m-cible", "Bob", Date.now() + 100_000);
    const command = creerRenameCancelCommand(store);
    const { interaction, captured } = fakeInteraction({ store });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(true);
    expect(captured.edited).toBe("Bob"); // pseudo original restaure
    expect(captured.ephemeral).toBe(false); // confirmation visible
    // La ligne de persistance a ete supprimee.
    expect(await store.getPending("g-test", "m-cible")).toBeNull();
    expect(await store.get("g-test", "m-cible")).toBeNull();
  });

  it("membre introuvable -> message clair, AUCUN edit", async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCancelCommand(store);
    const { interaction, captured } = fakeInteraction({ store, memberNull: true });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("introuvable");
  });

  it("echec de la restauration (hierarchie/Forbidden) -> ephemere, ligne CONSERVEE pour retenter", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g-test", "m-cible", "Bob", Date.now() + 100_000);
    const command = creerRenameCancelCommand(store);
    const { interaction, captured } = fakeInteraction({ store, editThrows: true });
    await command.execute(interaction);
    expect(captured.ephemeral).toBe(true);
    // La ligne reste : l echeance sera retentee par le job de balayage.
    expect(await store.getPending("g-test", "m-cible")).not.toBeNull();
  });
});

describe("commande /rename-cancel — SOCLE i18n (locale de la guilde Discord)", () => {
  it("aucun renommage temporaire : le message est localise en EN (guilde en-US)", async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCancelCommand(store);
    const { interaction, captured } = fakeInteraction({ store, discordLocale: "en-US" });
    await command.execute(interaction);
    expect(captured.content).toBe(en.renameCancel.aucunRenommageTemporaire);
  });

  it("confirmation de restauration : localisee en EN (guilde en-US)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g-test", "m-cible", "Bob", Date.now() + 100_000);
    const command = creerRenameCancelCommand(store);
    const { interaction, captured } = fakeInteraction({ store, discordLocale: "en-US" });
    await command.execute(interaction);
    expect(captured.content).toBe(en.renameCancel.confirmation({ membre: "@cible", pseudo: "Bob" }));
  });
});
