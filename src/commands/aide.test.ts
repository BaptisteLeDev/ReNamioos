/**
 * Test d'acceptation de /aide.
 *
 * Successeur de aide_slash (bot.py:399). ÉCART VOLONTAIRE (B4, ADR-0003
 * decision 1) : annonce "9 styles" (le legacy disait "8 styles" en dur et
 * omettait scriptify). Le nombre est DERIVE de STYLE_NAMES, pas un litteral.
 *
 * Mock Discord a la frontiere uniquement.
 */
import { describe, expect, it } from "bun:test";
import { STYLE_NAMES } from "../domain/styles";
import type { MappingRoleStyle } from "../domain/auto-rename";
import type { MappingStore } from "../mapping/store";
import { creerAideCommand } from "./aide";

/** Store fake lecture seule : meme mapping pour la guild de test (B8). */
function fakeStore(mapping: MappingRoleStyle): MappingStore {
  return {
    styleForRole: (_g, r) => Promise.resolve(mapping[r] ?? null),
    add: () => Promise.reject(new Error("lecture seule (test)")),
    remove: () => Promise.reject(new Error("lecture seule (test)")),
    list: () => Promise.resolve({ ...mapping }),
  };
}

function fakeInteraction(guildId: string | null = "guild-1") {
  const captured: { embeds: { data: { fields?: { value: string }[] } }[]; defere: boolean } = {
    embeds: [],
    defere: false,
  };
  const capter = (payload: { embeds?: never[] }) => {
    captured.embeds = (payload.embeds ?? captured.embeds) as never;
    return Promise.resolve();
  };
  return {
    interaction: {
      guildId,
      deferReply: () => {
        captured.defere = true;
        return Promise.resolve();
      },
      reply: capter,
      editReply: capter,
    } as never,
    captured,
  };
}

const SANS_ROLES: MappingStore = fakeStore({});

describe("commande /aide", () => {
  it('se nomme "aide" et a une description', () => {
    const aideCommand = creerAideCommand(SANS_ROLES);
    expect(aideCommand.data.name).toBe("aide");
    expect(aideCommand.data.description.length).toBeGreaterThan(0);
  });

  it("annonce le nombre REEL de styles (9, derive du domaine)", async () => {
    const { interaction, captured } = fakeInteraction();
    await creerAideCommand(SANS_ROLES).execute(interaction);
    const texte = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join("\n");
    expect(texte).toContain(`${STYLE_NAMES.length} styles`);
    expect(STYLE_NAMES.length).toBe(9); // garde-fou : la decision B4 est bien 9
  });

  it("liste les commandes publiques", async () => {
    const { interaction, captured } = fakeInteraction();
    await creerAideCommand(SANS_ROLES).execute(interaction);
    const texte = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join("\n");
    for (const cmd of ["/styles", "/convert", "/preview", "/rename", "/random", "/ping"]) {
      expect(texte).toContain(cmd);
    }
  });

  it("derive « Rôles configurés » du store auto-rename PAR GUILD (B8, source unique)", async () => {
    const { interaction, captured } = fakeInteraction("guild-1");
    const store = fakeStore({ "111": "scriptify", "222": "cursive" });
    await creerAideCommand(store).execute(interaction);
    const texte = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join("\n");
    expect(texte).toContain("Rôles configurés : 2");
  });

  it("DEFERE la reponse AVANT l I/O DB (cold-start > 3s, T3/audit)", async () => {
    let defereAvantList = false;
    const state = { defere: false };
    const store: MappingStore = {
      styleForRole: () => Promise.resolve(null),
      add: () => Promise.reject(new Error("lecture seule (test)")),
      remove: () => Promise.reject(new Error("lecture seule (test)")),
      list: () => {
        defereAvantList = state.defere; // capture l ordre : defer doit preceder le read DB
        return Promise.resolve({});
      },
    };
    const interaction = {
      guildId: "g1",
      deferReply: () => {
        state.defere = true;
        return Promise.resolve();
      },
      reply: () => Promise.resolve(),
      editReply: () => Promise.resolve(),
    } as never;
    await creerAideCommand(store).execute(interaction);
    expect(state.defere).toBe(true);
    expect(defereAvantList).toBe(true);
  });

  it("hors serveur (DM, guildId null) -> « Rôles configurés : 0 » sans lire le store", async () => {
    const { interaction, captured } = fakeInteraction(null);
    const store = fakeStore({ "111": "scriptify" });
    await creerAideCommand(store).execute(interaction);
    const texte = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join("\n");
    expect(texte).toContain("Rôles configurés : 0");
  });
});
