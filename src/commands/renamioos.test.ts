/**
 * Test d'acceptation de /renamioos (issue #27 + « style signature par membre »).
 *
 * Commande MEMBRE (aucune permission requise) : consentement (opt-out/opt-in) ET signature de
 * style (style/reset). Persiste via les ports OptOutStore et StylePreferenceStore (fakes en
 * memoire). La signature PRIME sur le style du role a l'auto-rename (regle pure styleEffectif,
 * testee cote domaine). PII minimale : `reset` SUPPRIME la ligne. Mock Discord a la frontiere.
 */
import { describe, expect, it } from "bun:test";
import type { OptOutStore } from "../optout/store";
import type { StylePreferenceStore } from "../style-preference/store";
import type { StyleName } from "../domain/styles";
import { creerMemoryStylePreferenceStore } from "../style-preference/memory-store";
import { creerRenamioosCommand } from "./renamioos";

/** Store opt-out fake : ensemble de cles `${guildId}:${memberId}`. */
function fakeOptOut(initial: string[] = []): OptOutStore {
  const data = new Set(initial);
  return {
    isOptOut: (g, m) => Promise.resolve(data.has(`${g}:${m}`)),
    optOut: (g, m) => {
      data.add(`${g}:${m}`);
      return Promise.resolve();
    },
    optIn: (g, m) => {
      data.delete(`${g}:${m}`);
      return Promise.resolve();
    },
  };
}

interface Scenario {
  sub: "opt-out" | "opt-in" | "style" | "reset";
  guildId?: string | null;
  memberId?: string;
  style?: string;
}

interface Captured {
  content: string;
  ephemeral: boolean;
  embeds: unknown[];
}

function fakeInteraction(s: Scenario) {
  const captured: Captured = { content: "", ephemeral: false, embeds: [] };
  const interaction = {
    guildId: s.guildId === undefined ? "guild-1" : s.guildId,
    user: { id: s.memberId ?? "member-1" },
    options: {
      getSubcommand: () => s.sub,
      getString: (_name: string, _required?: boolean) => s.style ?? null,
    },
    reply: (payload: { content?: string; ephemeral?: boolean; embeds?: unknown[] }) => {
      captured.content = payload.content ?? "";
      captured.ephemeral = payload.ephemeral ?? false;
      captured.embeds = payload.embeds ?? [];
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

function creerCmd(
  optOut: OptOutStore = fakeOptOut(),
  pref: StylePreferenceStore = creerMemoryStylePreferenceStore(),
) {
  return creerRenamioosCommand(optOut, pref);
}

describe("commande /renamioos", () => {
  it('se nomme "renamioos" et a une description', () => {
    const cmd = creerCmd();
    expect(cmd.data.name).toBe("renamioos");
    expect(cmd.data.description.length).toBeGreaterThan(0);
  });

  it("expose les 4 sous-commandes opt-out / opt-in / style / reset", () => {
    const json = creerCmd().data.toJSON();
    const noms = (json.options ?? []).map((o) => o.name).toSorted();
    expect(noms).toEqual(["opt-in", "opt-out", "reset", "style"]);
  });

  it("propose l autocomplete du style", () => {
    expect(typeof creerCmd().autocomplete).toBe("function");
  });

  it("NE requiert PAS de permission (commande membre)", () => {
    const json = creerCmd().data.toJSON();
    expect(json.default_member_permissions ?? null).toBeNull();
  });

  it("hors serveur (guildId null) -> refus ephemeral", async () => {
    const { interaction, captured } = fakeInteraction({ sub: "opt-out", guildId: null });
    await creerCmd().execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("serveur");
  });

  it("opt-out persiste l etat pour (guild, membre) et confirme en ephemeral", async () => {
    const store = fakeOptOut();
    const { interaction, captured } = fakeInteraction({
      sub: "opt-out",
      memberId: "m-42",
      guildId: "g-1",
    });
    await creerCmd(store).execute(interaction);
    expect(await store.isOptOut("g-1", "m-42")).toBe(true);
    expect(captured.ephemeral).toBe(true);
  });

  it("opt-in retire l etat (reactive l auto-rename) et confirme", async () => {
    const store = fakeOptOut(["g-1:m-42"]);
    const { interaction, captured } = fakeInteraction({
      sub: "opt-in",
      memberId: "m-42",
      guildId: "g-1",
    });
    await creerCmd(store).execute(interaction);
    expect(await store.isOptOut("g-1", "m-42")).toBe(false);
    expect(captured.ephemeral).toBe(true);
  });
});

describe("/renamioos style|reset — signature de style par membre", () => {
  it("style:<style> persiste la signature pour (guild, membre) et confirme en ephemeral", async () => {
    const pref = creerMemoryStylePreferenceStore();
    const { interaction, captured } = fakeInteraction({
      sub: "style",
      style: "gothique",
      memberId: "m-1",
      guildId: "g-1",
    });
    await creerCmd(fakeOptOut(), pref).execute(interaction);
    expect(await pref.get("g-1", "m-1")).toBe("gothique");
    expect(captured.ephemeral).toBe(true);
    expect(captured.embeds.length).toBe(1);
  });

  it("style inconnu -> refus ephemere, rien persiste", async () => {
    const pref = creerMemoryStylePreferenceStore();
    const { interaction, captured } = fakeInteraction({
      sub: "style",
      style: "inexistant",
      memberId: "m-1",
      guildId: "g-1",
    });
    await creerCmd(fakeOptOut(), pref).execute(interaction);
    expect(await pref.get("g-1", "m-1")).toBeNull();
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("inconnu");
  });

  it("reset SUPPRIME la signature (minimisation PII D8)", async () => {
    const pref = creerMemoryStylePreferenceStore();
    await pref.set("g-1", "m-1", "gothique" as StyleName);
    const { interaction, captured } = fakeInteraction({
      sub: "reset",
      memberId: "m-1",
      guildId: "g-1",
    });
    await creerCmd(fakeOptOut(), pref).execute(interaction);
    expect(await pref.get("g-1", "m-1")).toBeNull();
    expect(captured.ephemeral).toBe(true);
  });

  it("la signature est CIBLEE par membre et par serveur", async () => {
    const pref = creerMemoryStylePreferenceStore();
    const { interaction } = fakeInteraction({
      sub: "style",
      style: "cursive",
      memberId: "m-1",
      guildId: "g-1",
    });
    await creerCmd(fakeOptOut(), pref).execute(interaction);
    expect(await pref.get("g-2", "m-1")).toBeNull();
    expect(await pref.get("g-1", "m-2")).toBeNull();
  });
});
