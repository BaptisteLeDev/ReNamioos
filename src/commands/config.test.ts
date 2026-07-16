/**
 * Commande /config (socle) : personnalisation du bot PAR SERVEUR (langue, couleur), admin
 * ManageGuild, reponses ephemeres, validation par VO. On teste l'adapter sans vraie
 * interaction Discord en injectant un double structurel de ChatInputCommandInteraction et un
 * store en memoire (frontiere I/O reelle, pas mock).
 */
import { describe, expect, it } from "bun:test";
import { PermissionFlagsBits } from "discord.js";
import { creerConfigCommand } from "./config";
import { fr, en } from "../i18n/catalog";
import { parseEmbedColor } from "../domain/embed-color";
import { creerMemoryGuildSettingsStore } from "../guildsettings/memory-store";
import { creerEmbedFactory } from "../theming/embed";
import { THEME_RENAMIOOS } from "../theming/theme";
import type { GuildSettingsStore } from "../guildsettings/store";

interface OptionsFake {
  sub: string;
  strings?: Record<string, string>;
  manageGuild?: boolean;
  guildId?: string | null;
  discordLocale?: string;
}

function fakeInteraction(opts: OptionsFake) {
  const replies: { content?: string; ephemeral?: boolean; embeds?: unknown[] }[] = [];
  const guildId = opts.guildId === undefined ? "g1" : opts.guildId;
  return {
    replies,
    interaction: {
      guildId,
      guild: guildId ? { preferredLocale: opts.discordLocale ?? "fr" } : null,
      locale: opts.discordLocale ?? "fr",
      inGuild: () => guildId !== null,
      memberPermissions: { has: (_flag: bigint) => opts.manageGuild ?? true },
      options: {
        getSubcommand: () => opts.sub,
        getString: (name: string) => opts.strings?.[name] ?? null,
      },
      reply: (payload: { content?: string; ephemeral?: boolean; embeds?: unknown[] }) => {
        replies.push(payload);
        return Promise.resolve();
      },
    },
  };
}

function creerCommande(store: GuildSettingsStore) {
  return creerConfigCommand(store, creerEmbedFactory(THEME_RENAMIOOS));
}

describe("commande /config — schema", () => {
  it("se nomme config, a une description et exige ManageGuild", () => {
    const cmd = creerCommande(creerMemoryGuildSettingsStore());
    const json = cmd.data.toJSON();
    expect(json.name).toBe("config");
    expect(json.description.length).toBeGreaterThan(0);
    expect(json.default_member_permissions).toBe(PermissionFlagsBits.ManageGuild.toString());
  });

  it("declare les sous-commandes langue, couleur, afficher", () => {
    const cmd = creerCommande(creerMemoryGuildSettingsStore());
    const noms = (cmd.data.toJSON().options ?? []).map((o) => o.name);
    expect(noms).toEqual(["langue", "couleur", "afficher"]);
  });
});

describe("commande /config — execution", () => {
  it("langue : persiste l'override et repond en ephemere", async () => {
    const store = creerMemoryGuildSettingsStore();
    const { interaction, replies } = fakeInteraction({ sub: "langue", strings: { langue: "en" } });
    await creerCommande(store).execute(interaction as never);
    expect((await store.get("g1")).preferredLocale).toBe("en");
    expect(replies[0]?.ephemeral).toBe(true);
    expect(replies[0]?.content).toContain("en");
  });

  it("couleur : hex valide persiste la couleur", async () => {
    const store = creerMemoryGuildSettingsStore();
    const { interaction } = fakeInteraction({ sub: "couleur", strings: { valeur: "#ff8800" } });
    await creerCommande(store).execute(interaction as never);
    expect((await store.get("g1")).embedColor).toBe(parseEmbedColor(0xff8800));
  });

  it("couleur : reset efface la couleur", async () => {
    const store = creerMemoryGuildSettingsStore();
    await store.setEmbedColor("g1", parseEmbedColor(0x123456)!);
    const { interaction } = fakeInteraction({ sub: "couleur", strings: { valeur: "reset" } });
    await creerCommande(store).execute(interaction as never);
    expect((await store.get("g1")).embedColor).toBeNull();
  });

  it("couleur : hex invalide ne persiste rien et signale l'erreur", async () => {
    const store = creerMemoryGuildSettingsStore();
    const { interaction, replies } = fakeInteraction({
      sub: "couleur",
      strings: { valeur: "pas-une-couleur" },
    });
    await creerCommande(store).execute(interaction as never);
    expect((await store.get("g1")).embedColor).toBeNull();
    expect(replies[0]?.ephemeral).toBe(true);
    expect(replies[0]?.content).toBe(fr.config.couleur.invalide);
  });

  it("langue : valeur invalide signale une erreur de LANGUE (pas de couleur)", async () => {
    const store = creerMemoryGuildSettingsStore();
    const { interaction, replies } = fakeInteraction({ sub: "langue", strings: { langue: "xx" } });
    await creerCommande(store).execute(interaction as never);
    expect((await store.get("g1")).preferredLocale).toBeNull();
    expect(replies[0]?.content).toBe(fr.config.langue.invalide);
    expect(replies[0]?.content).not.toBe(fr.config.couleur.invalide);
  });

  it("refuse l'execution sans permission ManageGuild (defense en profondeur)", async () => {
    const store = creerMemoryGuildSettingsStore();
    const { interaction, replies } = fakeInteraction({
      sub: "langue",
      strings: { langue: "en" },
      manageGuild: false,
    });
    await creerCommande(store).execute(interaction as never);
    expect((await store.get("g1")).preferredLocale).toBeNull();
    expect(replies[0]?.ephemeral).toBe(true);
    expect(replies[0]?.content).toBe(fr.config.permissionRefusee);
  });

  it("hors serveur (guildId null) : refus localise", async () => {
    const store = creerMemoryGuildSettingsStore();
    const { interaction, replies } = fakeInteraction({ sub: "afficher", guildId: null });
    await creerCommande(store).execute(interaction as never);
    expect(replies[0]?.content).toBe(fr.config.horsServeur);
  });

  it("afficher : repond un embed ephemere", async () => {
    const store = creerMemoryGuildSettingsStore();
    const { interaction, replies } = fakeInteraction({ sub: "afficher" });
    await creerCommande(store).execute(interaction as never);
    expect(replies[0]?.ephemeral).toBe(true);
    expect(replies[0]?.embeds?.length).toBe(1);
  });

  it("SOCLE : la reponse est localisee dans la locale de la guilde Discord (en-US -> EN)", async () => {
    const store = creerMemoryGuildSettingsStore();
    const { interaction, replies } = fakeInteraction({
      sub: "langue",
      strings: { langue: "xx" },
      discordLocale: "en-US",
    });
    await creerCommande(store).execute(interaction as never);
    expect(replies[0]?.content).toBe(en.config.langue.invalide);
  });
});
