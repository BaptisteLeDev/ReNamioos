/**
 * Test d'acceptation de /convert <texte> <style>.
 *
 * Successeur de convert_slash (bot.py:218). Adapter pur : extrait texte+style, appelle le
 * domaine (convertirTexte), repose le resultat. ÉCART VOLONTAIRE (B4, ADR-0003 decision 3) :
 * l'erreur metier est traduite en message ephemere ; aucun rendu fantaisiste.
 *
 * PREUVE D'USAGE DU SOCLE : l'embed de succes est desormais produit par la FABRIQUE THEMEE
 * (couleur du theme, ou override de la guilde via /config) et son titre/champs sont resolus
 * dans la LOCALE effective (override /config > locale Discord > FR). Mock Discord a la
 * frontiere uniquement ; le domaine reste sans mock.
 */
import { describe, expect, it } from "bun:test";
import { creerConvertCommand } from "./convert";
import { creerMemoryGuildSettingsStore } from "../guildsettings/memory-store";
import { creerEmbedFactory } from "../theming/embed";
import { THEME_RENAMIOOS } from "../theming/theme";
import { parseEmbedColor } from "../domain/embed-color";
import type { GuildSettingsStore } from "../guildsettings/store";
import { en } from "../i18n/catalog";

interface Captured {
  embeds: { data: { color?: number; title?: string; fields?: { name: string; value: string }[] } }[];
  content: string;
  ephemeral: boolean;
}

/** Double : interaction avec options string (texte/style), contexte guilde, reply capturee. */
function fakeInteraction(opts: { texte: string; style: string; discordLocale?: string }) {
  const captured: Captured = { embeds: [], content: "", ephemeral: false };
  const interaction = {
    guildId: "g1",
    guild: { preferredLocale: opts.discordLocale ?? "fr" },
    locale: opts.discordLocale ?? "fr",
    options: {
      getString: (name: string, _required?: boolean) =>
        name === "texte" ? opts.texte : opts.style,
    },
    reply: (payload: { embeds?: never[]; content?: string; ephemeral?: boolean }) => {
      captured.embeds = (payload.embeds ?? []) as never;
      captured.content = payload.content ?? "";
      captured.ephemeral = payload.ephemeral ?? false;
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

function creerCmd(store: GuildSettingsStore = creerMemoryGuildSettingsStore()) {
  return creerConvertCommand(store, creerEmbedFactory(THEME_RENAMIOOS));
}

describe("commande /convert", () => {
  it('se nomme "convert" et a une description', () => {
    expect(creerCmd().data.name).toBe("convert");
    expect(creerCmd().data.description.length).toBeGreaterThan(0);
  });

  it("stylise un texte et repond un embed (Original + Resultat)", async () => {
    const { interaction, captured } = fakeInteraction({ texte: "abc", style: "cursive" });
    await creerCmd().execute(interaction);
    expect(captured.embeds.length).toBe(1);
    const fields = captured.embeds[0]?.data.fields ?? [];
    const valeurs = fields.map((f) => f.value).join(" ");
    expect(valeurs).toContain("abc"); // original repris
    expect(valeurs).toContain("\u{1d4d0}\u{1d4eb}\u{1d4ec}"); // 𝓐𝓫𝓬 (resultat stylise)
  });

  it("la reponse de SUCCES est EPHEMERE (B4, #45)", async () => {
    const { interaction, captured } = fakeInteraction({ texte: "abc", style: "cursive" });
    await creerCmd().execute(interaction);
    expect(captured.embeds.length).toBe(1);
    expect(captured.ephemeral).toBe(true);
  });

  it("SOCLE : l'embed prend la couleur du THEME par defaut", async () => {
    const { interaction, captured } = fakeInteraction({ texte: "abc", style: "cursive" });
    await creerCmd().execute(interaction);
    expect(captured.embeds[0]?.data.color).toBe(THEME_RENAMIOOS.couleurDefaut);
  });

  it("SOCLE : l'embed prend la COULEUR de la guilde quand /config en a pose une", async () => {
    const store = creerMemoryGuildSettingsStore();
    const rose = parseEmbedColor("#ff33cc")!;
    await store.setEmbedColor("g1", rose);
    const { interaction, captured } = fakeInteraction({ texte: "abc", style: "cursive" });
    await creerCmd(store).execute(interaction);
    expect(captured.embeds[0]?.data.color).toBe(rose);
  });

  it("SOCLE : le titre est resolu dans la LOCALE effective (guilde en-US -> EN)", async () => {
    const { interaction, captured } = fakeInteraction({
      texte: "abc",
      style: "cursive",
      discordLocale: "en-US",
    });
    await creerCmd().execute(interaction);
    // Titre EN (« Converted to … ») : la locale Discord a ete resolue et appliquee.
    expect(captured.embeds[0]?.data.title).toContain("Converted");
    expect(captured.embeds[0]?.data.fields?.[0]?.name).toBe(en.convert.champOriginal);
  });

  it("style inconnu -> message ephemere, aucun embed", async () => {
    const { interaction, captured } = fakeInteraction({ texte: "abc", style: "inexistant" });
    await creerCmd().execute(interaction);
    expect(captured.embeds.length).toBe(0);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("inconnu");
  });

  it('texte deja stylise -> refus propre ephemere ("deja stylise")', async () => {
    const dejaStylise = "\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}"; // 𝓗𝓮𝓵𝓵𝓸
    const { interaction, captured } = fakeInteraction({ texte: dejaStylise, style: "cursive" });
    await creerCmd().execute(interaction);
    expect(captured.embeds.length).toBe(0);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("déjà stylisé");
  });

  it("texte trop long -> refus ephemere, aucun embed (finding #24)", async () => {
    const tropLong = "a".repeat(501);
    const { interaction, captured } = fakeInteraction({ texte: tropLong, style: "cursive" });
    await creerCmd().execute(interaction);
    expect(captured.embeds.length).toBe(0);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("trop long");
  });

  it("texte a la limite (500) -> stylise normalement", async () => {
    const limite = "a".repeat(500);
    const { interaction, captured } = fakeInteraction({ texte: limite, style: "cursive" });
    await creerCmd().execute(interaction);
    expect(captured.embeds.length).toBe(1);
  });
});
