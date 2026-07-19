/**
 * Test d'acceptation de /random <membre> [nouveau_nom].
 *
 * Successeur de random_slash (bot.py:344). Choisit un style ALEATOIRE parmi les
 * 9, puis applique le MEME flux de rename que /rename (permission appelant,
 * source nick||name, troncature 32, hierarchie, refus propre). Pas de check de
 * style (toujours valide). On teste sans controler le RNG : quel que soit le
 * style tire, les invariants observables tiennent.
 *
 * Mock Discord a la frontiere uniquement.
 */
import { describe, expect, it } from "bun:test";
import { PermissionFlagsBits } from "discord.js";
import { creerRandomCommand } from "./random";
import { creerCompteurFenetre } from "../limitation/compteur-fenetre";
import { en } from "../i18n/catalog";

/** Commande par defaut (cooldown propre) pour les scenarios qui ne testent pas le cooldown. */
const randomCommand = creerRandomCommand();

/** Invocateurs par defaut UNIQUES : deux scenarios sans cooldown explicite n'interagissent pas. */
let compteurInvocateur = 0;

interface Scenario {
  canManageNicknames?: boolean;
  manageable?: boolean;
  member?: { nick: string | null; name: string };
  nouveauNom?: string | null;
  userId?: string;
  guildId?: string;
  discordLocale?: string;
}

interface Captured {
  edited: string | null | undefined;
  editCalled: boolean;
  content: string;
  ephemeral: boolean;
  embeds: unknown[];
}

function fakeInteraction(s: Scenario) {
  const captured: Captured = {
    edited: undefined,
    editCalled: false,
    content: "",
    ephemeral: false,
    embeds: [],
  };
  const member = s.member ?? { nick: null, name: "renamio" };
  const targetMember = {
    nickname: member.nick,
    user: { username: member.name },
    displayName: member.nick ?? member.name,
    toString: () => "@cible",
    manageable: s.manageable ?? true,
    edit: (data: { nick?: string | null }) => {
      captured.editCalled = true;
      captured.edited = data.nick;
      return Promise.resolve();
    },
  };
  const interaction = {
    guildId: s.guildId ?? "g-test",
    guild: { preferredLocale: s.discordLocale ?? "fr" },
    locale: s.discordLocale ?? "fr",
    user: { id: s.userId ?? `u-${++compteurInvocateur}` },
    memberPermissions: {
      has: (perm: bigint) =>
        perm === PermissionFlagsBits.ManageNicknames ? (s.canManageNicknames ?? true) : false,
    },
    options: {
      getMember: () => targetMember,
      getString: () => s.nouveauNom ?? null,
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

describe("commande /random", () => {
  it('se nomme "random", a une description et exige Manage Nicknames', () => {
    expect(randomCommand.data.name).toBe("random");
    expect(randomCommand.data.description.length).toBeGreaterThan(0);
    const json = randomCommand.data.toJSON();
    expect(json.default_member_permissions).toBe(PermissionFlagsBits.ManageNicknames.toString());
  });

  it("renomme avec un style aleatoire (sortie non vide, != source) et confirme", async () => {
    const { interaction, captured } = fakeInteraction({ nouveauNom: "renamio" });
    await randomCommand.execute(interaction);
    expect(captured.editCalled).toBe(true);
    expect(captured.edited).toBeTruthy();
    expect(captured.edited).not.toBe("renamio"); // un vrai rendu stylise
    expect(captured.embeds.length).toBe(1);
  });

  it("permission appelant manquante -> ephemere, AUCUN edit", async () => {
    const { interaction, captured } = fakeInteraction({
      nouveauNom: "abc",
      canManageNicknames: false,
    });
    await randomCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("permission");
  });

  it("texte deja stylise -> refus propre ephemere, AUCUN edit", async () => {
    const deja = "\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}"; // 𝓗𝓮𝓵𝓵𝓸
    const { interaction, captured } = fakeInteraction({ nouveauNom: deja });
    await randomCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("déjà stylisé");
  });

  it("hierarchie de roles (membre non gerable) -> ephemere, AUCUN edit", async () => {
    const { interaction, captured } = fakeInteraction({ nouveauNom: "abc", manageable: false });
    await randomCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("hiérarchie");
  });
});

describe("commande /random — cooldown anti mass-rename (B1)", () => {
  it("refuse le 4e renommage en 60 s (meme invocateur+guilde) en ephemere, AUCUN edit", async () => {
    let t = 1_000;
    const cooldown = creerCompteurFenetre({ now: () => t, limite: 3, fenetreMs: 60_000 });
    const command = creerRandomCommand(cooldown);
    for (let i = 0; i < 3; i++) {
      const { interaction, captured } = fakeInteraction({
        nouveauNom: `n${i}`,
        userId: "spam",
        guildId: "g1",
      });
      await command.execute(interaction);
      expect(captured.editCalled).toBe(true);
      t += 1_000;
    }
    const { interaction, captured } = fakeInteraction({
      nouveauNom: "encore",
      userId: "spam",
      guildId: "g1",
    });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("trop de renommages");
  });

  it("au plus 3 edits appliques quand 10 invocations concurrentes franchissent le check avant tout enregistrement (TOCTOU)", async () => {
    const t = 1_000;
    const cooldown = creerCompteurFenetre({ now: () => t, limite: 3, fenetreMs: 60_000 });
    const command = creerRandomCommand(cooldown);

    let editsAppliques = 0;
    let libererEdit!: () => void;
    const editEnAttente = new Promise<void>((resolve) => {
      libererEdit = resolve;
    });

    function invoquer(i: number) {
      const targetMember = {
        nickname: `nom${i}`,
        user: { username: `nom${i}` },
        displayName: `nom${i}`,
        toString: () => "@cible",
        manageable: true,
        edit: () => {
          editsAppliques++;
          return editEnAttente;
        },
      };
      const interaction = {
        guildId: "g1",
        user: { id: "spam" },
        memberPermissions: {
          has: (perm: bigint) => perm === PermissionFlagsBits.ManageNicknames,
        },
        options: { getMember: () => targetMember, getString: () => null },
        reply: () => Promise.resolve(),
      } as never;
      return command.execute(interaction);
    }

    const enCours = Array.from({ length: 10 }, (_, i) => invoquer(i));
    libererEdit();
    await Promise.all(enCours);

    expect(editsAppliques).toBeLessThanOrEqual(3);
  });

  it("cooldown PARTAGE avec /rename : le compteur commun couvre les deux commandes", async () => {
    // Une seule instance de cooldown injectee dans /random : 3 /random puis un 4e refuse.
    // La preuve du partage /rename<->/random est faite en composition (index.ts) ; ici on
    // verifie qu'une meme instance borne bien /random.
    let t = 1_000;
    const cooldown = creerCompteurFenetre({ now: () => t, limite: 3, fenetreMs: 60_000 });
    const command = creerRandomCommand(cooldown);
    for (let i = 0; i < 3; i++) {
      const { interaction } = fakeInteraction({ nouveauNom: `n${i}`, userId: "s", guildId: "g" });
      await command.execute(interaction);
      t += 1_000;
    }
    const { interaction, captured } = fakeInteraction({ nouveauNom: "x", userId: "s", guildId: "g" });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(false);
  });
});

describe("commande /random — SOCLE i18n (locale de la guilde Discord)", () => {
  it("succes : le titre de l'embed de confirmation est localise en EN (guilde en-US)", async () => {
    const { interaction, captured } = fakeInteraction({
      nouveauNom: "renamio",
      discordLocale: "en-US",
    });
    await randomCommand.execute(interaction);
    const embed = captured.embeds[0] as { data: { title?: string } };
    expect(embed.data.title).toBe(en.random.titreConfirmation);
  });

  it("hierarchie de roles : le refus est localise en EN (guilde en-US)", async () => {
    const { interaction, captured } = fakeInteraction({
      nouveauNom: "abc",
      manageable: false,
      discordLocale: "en-US",
    });
    await randomCommand.execute(interaction);
    expect(captured.content).toBe(en.styliser.hierarchieRenommer);
  });
});
