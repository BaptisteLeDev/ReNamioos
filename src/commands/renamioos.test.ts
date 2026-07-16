/**
 * Test d'acceptation de /renamioos (issue #27).
 *
 * Commande MEMBRE (aucune permission requise) : un membre refuse (`opt-out`) ou
 * reactive (`opt-in`) l'auto-rename SUR LUI, pour ce serveur. Persiste via le port
 * OptOutStore (injecte ici par un fake en memoire). Refus PROPRE (ephemeral) hors
 * serveur. Mock Discord A LA FRONTIERE uniquement ; le store est un fake (pas de DB).
 */
import { describe, expect, it } from "bun:test";
import type { OptOutStore } from "../optout/store";
import { creerRenamioosCommand } from "./renamioos";

/** Store opt-out fake : ensemble de cles `${guildId}:${memberId}`. */
function fakeStore(initial: string[] = []): OptOutStore {
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
  sub: "opt-out" | "opt-in";
  guildId?: string | null;
  memberId?: string;
}

interface Captured {
  content: string;
  ephemeral: boolean;
}

function fakeInteraction(s: Scenario) {
  const captured: Captured = { content: "", ephemeral: false };
  const interaction = {
    guildId: s.guildId === undefined ? "guild-1" : s.guildId,
    user: { id: s.memberId ?? "member-1" },
    options: { getSubcommand: () => s.sub },
    reply: (payload: { content?: string; ephemeral?: boolean }) => {
      captured.content = payload.content ?? "";
      captured.ephemeral = payload.ephemeral ?? false;
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

describe("commande /renamioos", () => {
  it('se nomme "renamioos" et a une description', () => {
    const cmd = creerRenamioosCommand(fakeStore());
    expect(cmd.data.name).toBe("renamioos");
    expect(cmd.data.description.length).toBeGreaterThan(0);
  });

  it("expose les 2 sous-commandes opt-out / opt-in", () => {
    const json = creerRenamioosCommand(fakeStore()).data.toJSON();
    const noms = (json.options ?? []).map((o) => o.name).toSorted();
    expect(noms).toEqual(["opt-in", "opt-out"]);
  });

  it("NE requiert PAS de permission (commande membre)", () => {
    const json = creerRenamioosCommand(fakeStore()).data.toJSON();
    // default_member_permissions null/undefined = visible par tous.
    expect(json.default_member_permissions ?? null).toBeNull();
  });

  it("hors serveur (guildId null) -> refus ephemeral", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({ sub: "opt-out", guildId: null });
    await creerRenamioosCommand(store).execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("serveur");
  });

  it("opt-out persiste l etat pour (guild, membre) et confirme en ephemeral", async () => {
    const store = fakeStore();
    const { interaction, captured } = fakeInteraction({
      sub: "opt-out",
      memberId: "m-42",
      guildId: "g-1",
    });
    await creerRenamioosCommand(store).execute(interaction);
    expect(await store.isOptOut("g-1", "m-42")).toBe(true);
    expect(captured.ephemeral).toBe(true);
  });

  it("opt-in retire l etat (reactive l auto-rename) et confirme", async () => {
    const store = fakeStore(["g-1:m-42"]);
    const { interaction, captured } = fakeInteraction({
      sub: "opt-in",
      memberId: "m-42",
      guildId: "g-1",
    });
    await creerRenamioosCommand(store).execute(interaction);
    expect(await store.isOptOut("g-1", "m-42")).toBe(false);
    expect(captured.ephemeral).toBe(true);
  });

  it("opt-out est CIBLE par membre et par guild", async () => {
    const store = fakeStore();
    const { interaction } = fakeInteraction({ sub: "opt-out", memberId: "m-1", guildId: "g-1" });
    await creerRenamioosCommand(store).execute(interaction);
    expect(await store.isOptOut("g-1", "m-1")).toBe(true);
    expect(await store.isOptOut("g-2", "m-1")).toBe(false); // autre serveur
    expect(await store.isOptOut("g-1", "m-2")).toBe(false); // autre membre
  });
});
