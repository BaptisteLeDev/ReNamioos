/**
 * Test d'acceptation de /rename <membre> <style> [nouveau_nom].
 *
 * Successeur de rename_slash (bot.py:282). Adapter : verifie la permission
 * Manage Nicknames de l'APPELANT, extrait le nom source (nouveau_nom sinon
 * nick||name), appelle le domaine, tronque a 32 code points, edite le nick.
 *
 * Erreurs propres (ECART VOLONTAIRE B4, ADR-0003 decision 3) :
 *  - permission appelant manquante -> ephemere, aucun edit ;
 *  - refus propre du domaine (style inconnu / deja stylise) -> ephemere, aucun edit ;
 *  - hierarchie de roles (membre non gerable / Forbidden) -> ephemere, aucun edit reussi.
 *
 * Mock Discord a la frontiere uniquement.
 */
import { describe, expect, it } from "bun:test";
import { DiscordAPIError, PermissionFlagsBits } from "discord.js";
import { creerRenameCommand } from "./rename";
import { creerMemoryOriginalNickStore } from "../original-nick/memory-store";
import type { OriginalNickStore } from "../original-nick/store";
import { creerCompteurFenetre } from "../limitation/compteur-fenetre";
import { en } from "../i18n/catalog";

interface Scenario {
  canManageNicknames?: boolean;
  manageable?: boolean;
  editThrows?: boolean;
  member?: { nick: string | null; name: string };
  style: string;
  nouveauNom?: string | null;
  duree?: string | null;
  store?: OriginalNickStore;
  userId?: string;
  guildId?: string;
  discordLocale?: string;
}

/** Commande par defaut (store memoire) pour les scenarios sans renommage temporaire. */
const renameCommand = creerRenameCommand(creerMemoryOriginalNickStore());

/** Invocateurs par defaut UNIQUES : deux scenarios sans cooldown explicite n'interagissent pas. */
let compteurInvocateur = 0;

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
    id: "m-cible",
    nickname: member.nick,
    user: { username: member.name },
    displayName: member.nick ?? member.name,
    guild: { id: "g-test" },
    toString: () => "@cible",
    manageable: s.manageable ?? true,
    edit: (data: { nick?: string | null }) => {
      captured.editCalled = true;
      // Forbidden bot realiste : DiscordAPIError 50013 (Missing Permissions), mappe vers le
      // message « permission » par styliser (audit #7 : seul 50013 est mappe permission).
      if (s.editThrows) {
        return Promise.reject(
          new DiscordAPIError(
            { code: 50013, message: "Missing Permissions" },
            50013,
            403,
            "PATCH",
            "https://discord.test/x",
            { files: [], body: {} },
          ),
        );
      }
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
      getString: (name: string) => {
        if (name === "style") return s.style;
        if (name === "duree") return s.duree ?? null;
        return s.nouveauNom ?? null;
      },
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

describe("commande /rename", () => {
  it('se nomme "rename", a une description et exige Manage Nicknames', () => {
    expect(renameCommand.data.name).toBe("rename");
    expect(renameCommand.data.description.length).toBeGreaterThan(0);
    // La permission par defaut est cablee sur la commande (defense en profondeur).
    const json = renameCommand.data.toJSON();
    expect(json.default_member_permissions).toBe(PermissionFlagsBits.ManageNicknames.toString());
  });

  it("renomme le membre avec le pseudo stylise et confirme par un embed", async () => {
    const { interaction, captured } = fakeInteraction({ style: "cursive", nouveauNom: "abc" });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(true);
    expect(captured.edited).toBe("\u{1d4d0}\u{1d4eb}\u{1d4ec}"); // 𝓐𝓫𝓬
    expect(captured.embeds.length).toBe(1);
    expect(captured.ephemeral).toBe(false);
  });

  it("utilise nick||name quand aucun nouveau_nom (source = nick prioritaire)", async () => {
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      member: { nick: "bob", name: "globalname" },
    });
    await renameCommand.execute(interaction);
    expect(captured.edited).toBe("\u{1d4d1}\u{1d4f8}\u{1d4eb}"); // 𝓑𝓸𝓫 (Bob stylise)
  });

  it("permission appelant manquante -> ephemere, AUCUN edit", async () => {
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      nouveauNom: "abc",
      canManageNicknames: false,
    });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("permission");
  });

  it("style inconnu -> refus propre ephemere, AUCUN edit", async () => {
    const { interaction, captured } = fakeInteraction({ style: "inexistant", nouveauNom: "abc" });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("inconnu");
  });

  it("texte deja stylise -> refus propre ephemere, AUCUN edit", async () => {
    const deja = "\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}"; // 𝓗𝓮𝓵𝓵𝓸
    const { interaction, captured } = fakeInteraction({ style: "cursive", nouveauNom: deja });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("déjà stylisé");
  });

  it("hierarchie de roles (membre non gerable) -> ephemere, AUCUN edit", async () => {
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      nouveauNom: "abc",
      manageable: false,
    });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("hiérarchie");
  });

  it("edit qui echoue (Forbidden bot) -> ephemere, pas de crash", async () => {
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      nouveauNom: "abc",
      editThrows: true,
    });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(true);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("permission");
  });
});

describe("commande /rename — renommage temporaire (issue #38)", () => {
  it("expose une option duree optionnelle", () => {
    const json = creerRenameCommand(creerMemoryOriginalNickStore()).data.toJSON();
    const duree = json.options?.find((o) => o.name === "duree");
    expect(duree).toBeDefined();
    expect(duree?.required ?? false).toBe(false);
  });

  it("avec duree valide : memorise le pseudo source pour auto-revert, renomme, confirme", async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCommand(store);
    const { interaction, captured } = fakeInteraction({
      store,
      style: "cursive",
      member: { nick: "Bob", name: "globalname" },
      duree: "2h",
    });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(true);
    // Le pseudo SOURCE (Bob) est memorise pour la restauration a l echeance.
    expect(await store.get("g-test", "m-cible")).toBe("Bob");
    expect(await store.listDue(Number.MAX_SAFE_INTEGER)).toHaveLength(1);
    expect(captured.embeds.length).toBe(1);
  });

  it("sans duree : NE memorise PAS d echeance (renommage permanent classique)", async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCommand(store);
    const { interaction } = fakeInteraction({ store, style: "cursive", nouveauNom: "abc" });
    await command.execute(interaction);
    expect(await store.listDue(Number.MAX_SAFE_INTEGER)).toHaveLength(0);
  });

  it("membre deja sous auto-rename par role : /rename duree POSE l echeance (ne devient PAS permanent, audit)", async () => {
    const store = creerMemoryOriginalNickStore();
    // Ligne role-based preexistante (expiresAt NULL) : original memorise = "Bob".
    await store.rememberIfAbsent("g-test", "m-cible", "Bob");
    const command = creerRenameCommand(store);
    const { interaction, captured } = fakeInteraction({ store, style: "cursive", duree: "2h" });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(true);
    // L echeance est bien ecrite : le sweep pourra reverter (listDue la retrouve).
    expect(await store.listDue(Number.MAX_SAFE_INTEGER)).toEqual([
      { guildId: "g-test", memberId: "m-cible", nick: "Bob" },
    ]);
    // L original role-based est preserve (pas ecrase par le pseudo courant deja stylise).
    expect(await store.get("g-test", "m-cible")).toBe("Bob");
  });

  it("echec d edit : NE forget PAS une ligne role-based preexistante (corollaire audit)", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g-test", "m-cible", "Bob"); // role-based, a preserver
    const command = creerRenameCommand(store);
    const { interaction, captured } = fakeInteraction({
      store,
      style: "cursive",
      duree: "2h",
      editThrows: true,
    });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(true);
    expect(captured.ephemeral).toBe(true);
    // La ligne role-based DOIT survivre : on ne l a pas creee.
    expect(await store.get("g-test", "m-cible")).toBe("Bob");
  });

  it("echec d edit : forget la ligne qu on a CREEE (aucune preexistante)", async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCommand(store);
    const { interaction } = fakeInteraction({
      store,
      style: "cursive",
      nouveauNom: "abc",
      duree: "2h",
      editThrows: true,
    });
    await command.execute(interaction);
    // Ligne creee puis oubliee sur echec : plus rien a reverter.
    expect(await store.get("g-test", "m-cible")).toBeNull();
  });

  it("duree invalide -> refus propre ephemere, AUCUN edit", async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCommand(store);
    const { interaction, captured } = fakeInteraction({
      store,
      style: "cursive",
      nouveauNom: "abc",
      duree: "n importe quoi",
    });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("durée");
  });
});

describe("commande /rename — cooldown anti mass-rename (B1)", () => {
  it("refuse le 4e renommage en 60 s (meme invocateur+guilde) en ephemere, AUCUN edit", async () => {
    let t = 1_000;
    const cooldown = creerCompteurFenetre({ now: () => t, limite: 3, fenetreMs: 60_000 });
    const command = creerRenameCommand(creerMemoryOriginalNickStore(), cooldown);

    // 3 renommages autorises (meme invocateur "spam", meme guilde "g1").
    for (let i = 0; i < 3; i++) {
      const { interaction, captured } = fakeInteraction({
        style: "cursive",
        nouveauNom: `nom${i}`,
        userId: "spam",
        guildId: "g1",
      });
      await command.execute(interaction);
      expect(captured.editCalled).toBe(true);
      t += 1_000;
    }

    // 4e dans la fenetre -> refuse, ephemere, aucun edit, avec le temps d'attente.
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      nouveauNom: "encore",
      userId: "spam",
      guildId: "g1",
    });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("trop de renommages");
    expect(captured.content).toMatch(/\d+\s*s/); // temps d'attente restant affiche
  });

  it("message de cooldown localise en EN (guilde en-US)", async () => {
    let t = 1_000;
    const cooldown = creerCompteurFenetre({ now: () => t, limite: 3, fenetreMs: 60_000 });
    const command = creerRenameCommand(creerMemoryOriginalNickStore(), cooldown);
    for (let i = 0; i < 3; i++) {
      const { interaction } = fakeInteraction({
        style: "cursive",
        nouveauNom: `n${i}`,
        userId: "spam-en",
        guildId: "g-en",
        discordLocale: "en-US",
      });
      await command.execute(interaction);
      t += 1_000;
    }
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      nouveauNom: "encore",
      userId: "spam-en",
      guildId: "g-en",
      discordLocale: "en-US",
    });
    await command.execute(interaction);
    const secondes = Math.ceil((60_000 - 3_000) / 1000);
    expect(captured.content).toBe(en.cooldown.tropDeRenommages({ secondes }));
  });

  it("un AUTRE invocateur sur la meme guilde n'est pas bloque", async () => {
    let t = 1_000;
    const cooldown = creerCompteurFenetre({ now: () => t, limite: 3, fenetreMs: 60_000 });
    const command = creerRenameCommand(creerMemoryOriginalNickStore(), cooldown);
    for (let i = 0; i < 3; i++) {
      const { interaction } = fakeInteraction({
        style: "cursive",
        nouveauNom: `n${i}`,
        userId: "spam",
        guildId: "g1",
      });
      await command.execute(interaction);
      t += 1_000;
    }
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      nouveauNom: "ok",
      userId: "autre",
      guildId: "g1",
    });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(true);
  });

  it("un renommage REFUSE (permission) ne consomme pas de jeton de cooldown", async () => {
    let t = 1_000;
    const cooldown = creerCompteurFenetre({ now: () => t, limite: 3, fenetreMs: 60_000 });
    const command = creerRenameCommand(creerMemoryOriginalNickStore(), cooldown);
    // 3 tentatives sans permission -> aucun edit, aucun jeton consomme.
    for (let i = 0; i < 3; i++) {
      const { interaction } = fakeInteraction({
        style: "cursive",
        nouveauNom: `n${i}`,
        userId: "u",
        guildId: "g1",
        canManageNicknames: false,
      });
      await command.execute(interaction);
      t += 1_000;
    }
    // Un renommage LEGITIME passe encore (les refus n'ont pas rempli la fenetre).
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      nouveauNom: "ok",
      userId: "u",
      guildId: "g1",
    });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(true);
  });
});

describe("commande /rename — cooldown atomique sous rafale concurrente (B1, TOCTOU)", () => {
  it("au plus 3 edits appliques quand 10 invocations concurrentes franchissent le check avant tout enregistrement", async () => {
    const t = 1_000;
    const cooldown = creerCompteurFenetre({ now: () => t, limite: 3, fenetreMs: 60_000 });
    const command = creerRenameCommand(creerMemoryOriginalNickStore(), cooldown);

    let editsAppliques = 0;
    let libererEdit!: () => void;
    // Un edit qui NE resout PAS immediatement : les invocations restent bloquees dessus,
    // reproduisant la rafale concurrente (aucune n'a encore pu enregistrer son jeton).
    const editEnAttente = new Promise<void>((resolve) => {
      libererEdit = resolve;
    });

    function invoquer(i: number) {
      const targetMember = {
        id: "m-cible",
        nickname: null,
        user: { username: `nom${i}` },
        displayName: `nom${i}`,
        guild: { id: "g1" },
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
        options: {
          getMember: () => targetMember,
          getString: (name: string) =>
            name === "style" ? "cursive" : name === "duree" ? null : `nom${i}`,
        },
        reply: () => Promise.resolve(),
      } as never;
      return command.execute(interaction);
    }

    // Lance 10 invocations SANS await entre elles : chaque execute() court jusqu'au
    // membre.edit (bloque) avant de rendre la main, donc toutes atteignent le check du
    // cooldown avant que la 1re n'ait fini. Seules 3 doivent aboutir a un edit.
    const enCours = Array.from({ length: 10 }, (_, i) => invoquer(i));
    libererEdit();
    await Promise.all(enCours);

    expect(editsAppliques).toBeLessThanOrEqual(3);
  });
});

describe("commande /rename — assainissement Unicode (B3)", () => {
  it("chemin COMMANDE : une source contenant zero-width/RTL est assainie avant edit", async () => {
    // 'a<ZWSP>b<RTL>c' -> assaini 'abc' -> stylise 𝓐𝓫𝓬 ; aucun Cf/Cc ne survit a member.edit.
    const source = `a\u{200B}b\u{202E}c`;
    const { interaction, captured } = fakeInteraction({ style: "cursive", nouveauNom: source });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(true);
    expect(captured.edited).toBe("\u{1d4d0}\u{1d4eb}\u{1d4ec}"); // 𝓐𝓫𝓬
    expect([...String(captured.edited)].some((c) => /[\p{Cf}\p{Cc}]/u.test(c))).toBe(false);
  });
});

describe("commande /rename — SOCLE i18n (locale de la guilde Discord)", () => {
  it("style inconnu : le refus est localise en EN (guilde en-US)", async () => {
    const { interaction, captured } = fakeInteraction({
      style: "inexistant",
      nouveauNom: "abc",
      discordLocale: "en-US",
    });
    await renameCommand.execute(interaction);
    expect(captured.content).toBe(en.styliser.styleInconnu({ style: "inexistant" }));
  });

  it("succes : le titre de l'embed de confirmation est localise en EN (guilde en-US)", async () => {
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      nouveauNom: "abc",
      discordLocale: "en-US",
    });
    await renameCommand.execute(interaction);
    const embed = captured.embeds[0] as { data: { title?: string } };
    expect(embed.data.title).toBe(en.rename.titreConfirmation);
  });

  it("duree invalide : le refus est localise en EN (guilde en-US)", async () => {
    const { interaction, captured } = fakeInteraction({
      style: "cursive",
      nouveauNom: "abc",
      duree: "n importe quoi",
      discordLocale: "en-US",
    });
    await renameCommand.execute(interaction);
    expect(captured.content).toBe(en.rename.dureeInvalide);
  });
});
