/**
 * Test d'acceptation du menu contextuel MESSAGE -> « Convertir en stylisé » (proposition
 * ReNamioos, axe UX, effort S).
 *
 * Clic droit sur un message -> Apps -> reponse EPHEMERE avec le texte rendu dans un style,
 * plus un select pour changer de style. Reutilise convertirTexte + LIMITE_TEXTE_CONVERT
 * (domaine), messageErreur, la fabrique themee (comme /convert). Le contenu d'un TIERS est
 * neutralise (markdown/mentions) avant affichage (issue #45). EPHEMERE uniquement : jamais
 * de republication. Mock Discord a la frontiere ; le domaine reste sans mock.
 */
import { describe, expect, it } from "bun:test";
import { ApplicationCommandType } from "discord.js";
import {
  creerConvertirContextuelCommand,
  creerGestionnaireConvertir,
  PREFIXE_CONVERTIR,
  customIdConvertir,
  parseCustomIdConvertir,
} from "./convertir-contextuel";
import { creerMemoryGuildSettingsStore } from "../guildsettings/memory-store";
import { creerEmbedFactory } from "../theming/embed";
import { THEME_RENAMIOOS } from "../theming/theme";

interface Captured {
  embeds: { data: { title?: string; fields?: { name: string; value: string }[] } }[];
  components: unknown[];
  content: string;
  ephemeral: boolean;
  allowedMentions?: { parse?: string[] };
  updated: boolean;
}

function creerCmd() {
  return creerConvertirContextuelCommand(
    creerMemoryGuildSettingsStore(),
    creerEmbedFactory(THEME_RENAMIOOS),
  );
}

/** Double : interaction de menu contextuel message (targetMessage porte le contenu tiers). */
function fakeContextMenu(opts: { contenu: string; channelId?: string; messageId?: string }) {
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
    channelId: opts.channelId ?? "chan-1",
    targetId: opts.messageId ?? "msg-1",
    targetMessage: { id: opts.messageId ?? "msg-1", content: opts.contenu },
    isMessageContextMenuCommand: () => true,
    reply: (payload: {
      embeds?: never[];
      components?: never[];
      content?: string;
      ephemeral?: boolean;
      allowedMentions?: { parse?: string[] };
    }) => {
      captured.embeds = (payload.embeds ?? []) as never;
      captured.components = payload.components ?? [];
      captured.content = payload.content ?? "";
      captured.ephemeral = payload.ephemeral ?? false;
      if (payload.allowedMentions !== undefined) captured.allowedMentions = payload.allowedMentions;
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

/** Double : interaction de select (values = [style choisi]) avec un client qui refetch le message. */
function fakeSelect(opts: {
  style: string;
  customId: string;
  contenuMessage?: string | null;
  messageIntrouvable?: boolean;
}) {
  const captured: Captured = {
    embeds: [],
    components: [],
    content: "",
    ephemeral: false,
    updated: false,
  };
  const message =
    opts.contenuMessage === null || opts.contenuMessage === undefined
      ? { id: "msg-1", content: "" }
      : { id: "msg-1", content: opts.contenuMessage };
  const interaction = {
    guildId: "g1",
    guild: { preferredLocale: "fr" },
    locale: "fr",
    customId: opts.customId,
    values: [opts.style],
    isStringSelectMenu: () => true,
    client: {
      channels: {
        fetch: (_id: string) =>
          Promise.resolve({
            isTextBased: () => true,
            messages: {
              fetch: (_mid: string) =>
                opts.messageIntrouvable
                  ? Promise.reject(new Error("Unknown Message"))
                  : Promise.resolve(message),
            },
          }),
      },
    },
    update: (payload: { embeds?: never[]; components?: never[] }) => {
      captured.embeds = (payload.embeds ?? []) as never;
      captured.components = payload.components ?? [];
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

describe("customId Convertir (stateless, restart-safe)", () => {
  it("encode et re-decode channelId + messageId", () => {
    const cid = customIdConvertir("chan-1", "msg-42");
    expect(cid.startsWith(PREFIXE_CONVERTIR)).toBe(true);
    expect(parseCustomIdConvertir(cid)).toEqual({ channelId: "chan-1", messageId: "msg-42" });
  });

  it("renvoie null pour un customId etranger", () => {
    expect(parseCustomIdConvertir("autre:chose")).toBeNull();
  });
});

describe("menu contextuel message -> Convertir", () => {
  it("est une commande de type MESSAGE avec un nom", () => {
    const json = creerCmd().data.toJSON();
    expect(json.type).toBe(ApplicationCommandType.Message);
    expect(json.name.length).toBeGreaterThan(0);
  });

  it("repond un embed EPHEMERE avec le texte stylise + un select de styles", async () => {
    const { interaction, captured } = fakeContextMenu({ contenu: "abc" });
    await creerCmd().execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.embeds.length).toBe(1);
    const valeurs = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join(" ");
    expect(valeurs).toContain("\u{1d4d0}\u{1d4eb}\u{1d4ec}"); // 𝓐𝓫𝓬 (cursive par defaut)
    expect(captured.components.length).toBeGreaterThan(0); // au moins une action row (select)
  });

  it("neutralise le markdown/mentions du contenu TIERS dans le champ Original", async () => {
    const { interaction, captured } = fakeContextMenu({ contenu: "**hi** @everyone" });
    await creerCmd().execute(interaction);
    const original = (captured.embeds[0]?.data.fields ?? []).map((f) => f.value).join(" ");
    expect(original).not.toContain("@everyone");
    expect(original).not.toContain("**hi**");
    // Defense en profondeur : aucune mention n'est parsee sur la reponse.
    expect(captured.allowedMentions?.parse ?? []).toEqual([]);
  });

  it("message sans contenu textuel -> refus ephemere, aucun embed", async () => {
    const { interaction, captured } = fakeContextMenu({ contenu: "   " });
    await creerCmd().execute(interaction);
    expect(captured.embeds.length).toBe(0);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.length).toBeGreaterThan(0);
  });

  it("contenu trop long -> tronque a la limite (rendu quand meme, avec mention)", async () => {
    const { interaction, captured } = fakeContextMenu({ contenu: "a".repeat(600) });
    await creerCmd().execute(interaction);
    // Rendu produit malgre la longueur (troncature, pas refus).
    expect(captured.embeds.length).toBe(1);
  });
});

describe("select de changement de style (Convertir)", () => {
  it("re-stylise le contenu du message refetch et MET A JOUR l'ephemere", async () => {
    const { interaction, captured } = fakeSelect({
      style: "gothique",
      customId: customIdConvertir("chan-1", "msg-1"),
      contenuMessage: "abc",
    });
    await creerGestionnaireConvertir(
      creerMemoryGuildSettingsStore(),
      creerEmbedFactory(THEME_RENAMIOOS),
    ).execute(interaction);
    expect(captured.updated).toBe(true);
    expect(captured.embeds.length).toBe(1);
  });

  it("message d'origine supprime -> repond proprement sans crasher", async () => {
    const { interaction, captured } = fakeSelect({
      style: "gothique",
      customId: customIdConvertir("chan-1", "msg-1"),
      messageIntrouvable: true,
    });
    await creerGestionnaireConvertir(
      creerMemoryGuildSettingsStore(),
      creerEmbedFactory(THEME_RENAMIOOS),
    ).execute(interaction);
    // Pas de mise a jour de contenu, mais une reponse d'erreur propre (pas d'exception).
    expect(captured.updated).toBe(false);
    expect(captured.content.length).toBeGreaterThan(0);
  });

  it("expose le bon prefixe de routage", () => {
    const h = creerGestionnaireConvertir(
      creerMemoryGuildSettingsStore(),
      creerEmbedFactory(THEME_RENAMIOOS),
    );
    expect(h.prefixe).toBe(PREFIXE_CONVERTIR);
  });
});
