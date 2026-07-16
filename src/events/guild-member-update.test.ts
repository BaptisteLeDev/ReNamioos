/**
 * Test d'acceptation de l'adapter Discord guildMemberUpdate (B6, ADR-0004).
 *
 * Cet adapter TRADUIT l'evenement Discord vers le domaine pur
 * (src/domain/auto-rename) puis applique via le flux PARTAGE appliquerRename
 * (src/commands/styliser). On mocke Discord A LA FRONTIERE uniquement (objets
 * member factices) ; le domaine reste sans mock.
 *
 * ECARTS VOLONTAIRES B6 verifies ici :
 *  - SOURCE = pseudo SERVEUR (nickname) s'il existe, sinon nom global (bug n°6).
 *  - DETECTION = diff d'ensembles : un echange a cardinalite egale declenche.
 *  - Echec (hierarchie / permission / refus propre) -> LOG STRUCTURE warn avec
 *    contexte {guildId, memberId, style}, JAMAIS d'exception ni de silence.
 */
import { describe, expect, it } from "bun:test";
import type { MappingRoleStyle } from "../domain/auto-rename";
import type { MappingStore } from "../mapping/store";
import type { OptOutStore } from "../optout/store";
import type { AutoRenameLogStore } from "../auto-rename-log/store";
import type { AutoRenameLogEntry } from "../domain/auto-rename-log";
import type { OriginalNickStore } from "../original-nick/store";
import { creerMemoryOriginalNickStore } from "../original-nick/memory-store";
import { creerCompteurFenetre } from "../limitation/compteur-fenetre";
import { creerGestionnaireMembreMisAJour } from "./guild-member-update";

const MAPPING: MappingRoleStyle = {
  role_cursive: "cursive",
  role_scriptify: "scriptify",
};

/**
 * Store FAKE en lecture seule : meme mapping pour toute guild (B8). L'adapter lit la
 * provenance via store.list(guildId) ; le domaine pur reste inchange (ADR-0004).
 */
function fakeStore(mapping: MappingRoleStyle): MappingStore {
  return {
    styleForRole: (_g, r) => Promise.resolve(mapping[r] ?? null),
    add: () => Promise.reject(new Error("lecture seule (test)")),
    remove: () => Promise.reject(new Error("lecture seule (test)")),
    list: () => Promise.resolve({ ...mapping }),
  };
}

interface MembreFake {
  nickname?: string | null;
  username?: string;
  roleIds: string[];
  guildId?: string;
  memberId?: string;
  manageable?: boolean;
  editThrows?: boolean;
}

interface Capture {
  editCalled: boolean;
  editedNick: string | null | undefined;
  warns: Array<{ message: string; contexte: Record<string, unknown> }>;
  journal: AutoRenameLogEntry[];
}

/** Store journal fake : capture les entrees enregistrees (issue #28). */
function fakeLogStore(journal: AutoRenameLogEntry[]): AutoRenameLogStore {
  return {
    record: (e) => {
      journal.push(e);
      return Promise.resolve();
    },
    recent: (g, n) =>
      Promise.resolve(
        journal
          .filter((e) => e.guildId === g)
          .slice(-n)
          .toReversed(),
      ),
    failuresToday: () => journal.filter((e) => e.outcome === "echec").length,
  };
}

/** Store opt-out fake : ensemble de cles `${guildId}:${memberId}` opt-out. */
function fakeOptOutStore(optOut: Set<string> = new Set()): OptOutStore {
  return {
    isOptOut: (g, m) => Promise.resolve(optOut.has(`${g}:${m}`)),
    optOut: (g, m) => {
      optOut.add(`${g}:${m}`);
      return Promise.resolve();
    },
    optIn: (g, m) => {
      optOut.delete(`${g}:${m}`);
      return Promise.resolve();
    },
  };
}

function fakeMember(m: MembreFake) {
  return {
    guild: { id: m.guildId ?? "guild-1" },
    id: m.memberId ?? "member-1",
    nickname: m.nickname ?? null,
    user: { username: m.username ?? "globalname" },
    manageable: m.manageable ?? true,
    roles: { cache: new Map(m.roleIds.map((id) => [id, { id }])) },
  };
}

function setup(
  old: MembreFake,
  neuf: MembreFake,
  optOut: Set<string> = new Set(),
  nickStore: OriginalNickStore = creerMemoryOriginalNickStore(),
) {
  const capture: Capture = { editCalled: false, editedNick: undefined, warns: [], journal: [] };
  const oldMember = fakeMember(old);
  const newMember = {
    ...fakeMember(neuf),
    edit: (data: { nick?: string | null }) => {
      capture.editCalled = true;
      if (neuf.editThrows) return Promise.reject(new Error("Missing Permissions"));
      capture.editedNick = data.nick;
      return Promise.resolve();
    },
  };
  const gestionnaire = creerGestionnaireMembreMisAJour({
    store: fakeStore(MAPPING),
    optOutStore: fakeOptOutStore(optOut),
    logStore: fakeLogStore(capture.journal),
    originalNickStore: nickStore,
    log: {
      warn: (message, contexte) => capture.warns.push({ message, contexte }),
    },
  });
  return { gestionnaire, oldMember, newMember, capture, nickStore };
}

describe("adapter guildMemberUpdate — auto-rename", () => {
  it("role mappe ajoute -> stylise le pseudo SERVEUR (nickname prioritaire, ECART B6)", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x"], nickname: "bob", username: "globalname" },
      { roleIds: ["x", "role_cursive"], nickname: "bob", username: "globalname" },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(true);
    // 'Bob' stylise en cursive (source = nickname 'bob', PAS 'globalname').
    expect(capture.editedNick).toBe("\u{1d4d1}\u{1d4f8}\u{1d4eb}"); // 𝓑𝓸𝓫
    // #28 : un succes est journalise avec le pseudo applique en detail.
    expect(capture.journal).toHaveLength(1);
    expect(capture.journal[0]).toMatchObject({ outcome: "succes", style: "cursive" });
  });

  it("source = nom global quand AUCUN nickname serveur", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x"], nickname: null, username: "abc" },
      { roleIds: ["x", "role_cursive"], nickname: null, username: "abc" },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editedNick).toBe("\u{1d4d0}\u{1d4eb}\u{1d4ec}"); // 𝓐𝓫𝓬
  });

  it("aucun role mappe ajoute -> AUCUN edit, AUCUN warn", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x"] },
      { roleIds: ["x", "role_non_mappe"] },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
    expect(capture.warns.length).toBe(0);
  });

  it("role mappe RETIRE -> AUCUN edit (seuls les ajouts declenchent)", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x", "role_cursive"] },
      { roleIds: ["x"] },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
  });

  it("echange simultane cardinalite egale (gain mappe) -> declenche (ECART B6)", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["role_perdu"], username: "abc" },
      { roleIds: ["role_cursive"], username: "abc" },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(true);
    expect(capture.editedNick).toBe("\u{1d4d0}\u{1d4eb}\u{1d4ec}"); // 𝓐𝓫𝓬
  });

  it("hierarchie (membre non gerable) -> LOG STRUCTURE warn, aucune exception", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x"], username: "abc" },
      {
        roleIds: ["x", "role_cursive"],
        username: "abc",
        manageable: false,
        guildId: "g7",
        memberId: "m9",
      },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.warns.length).toBe(1);
    expect(capture.warns[0]!.contexte).toMatchObject({
      guildId: "g7",
      memberId: "m9",
      style: "cursive",
    });
  });

  it("edit Discord echoue (Forbidden bot) -> LOG STRUCTURE warn, pas de crash", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x"], username: "abc" },
      {
        roleIds: ["x", "role_cursive"],
        username: "abc",
        editThrows: true,
        guildId: "g1",
        memberId: "m1",
      },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(true);
    expect(capture.warns.length).toBe(1);
    expect(capture.warns[0]!.contexte).toMatchObject({
      guildId: "g1",
      memberId: "m1",
      style: "cursive",
    });
    // #28 : un echec est journalise avec la raison en detail.
    expect(capture.journal).toHaveLength(1);
    expect(capture.journal[0]).toMatchObject({ outcome: "echec", guildId: "g1", memberId: "m1" });
  });

  it("refus propre du domaine (deja stylise) -> LOG STRUCTURE warn, AUCUN edit reussi", async () => {
    const deja = "\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}"; // 𝓗𝓮𝓵𝓵𝓸 (deja stylise)
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x"], nickname: deja },
      { roleIds: ["x", "role_cursive"], nickname: deja, guildId: "gz", memberId: "mz" },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
    expect(capture.warns.length).toBe(1);
    expect(capture.warns[0]!.contexte).toMatchObject({
      guildId: "gz",
      memberId: "mz",
      style: "cursive",
    });
  });

  it("membre OPT-OUT + role mappe ajoute -> AUCUN edit (consentement refuse, issue #27)", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x"], nickname: "bob" },
      { roleIds: ["x", "role_cursive"], nickname: "bob", guildId: "g1", memberId: "m-opt" },
      new Set(["g1:m-opt"]),
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
    expect(capture.warns.length).toBe(0); // refus de consentement = normal, pas un echec
    expect(capture.journal).toHaveLength(0); // opt-out n'est pas une tentative, rien a journaliser
  });

  it("opt-out CIBLE : un autre membre NON opt-out est bien renomme", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x"], nickname: "bob" },
      { roleIds: ["x", "role_cursive"], nickname: "bob", guildId: "g1", memberId: "m-ok" },
      new Set(["g1:un-autre"]),
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(true);
  });

  it("mapping vide -> jamais d auto-rename", async () => {
    const capture: Capture = { editCalled: false, editedNick: undefined, warns: [], journal: [] };
    const gestionnaire = creerGestionnaireMembreMisAJour({
      store: fakeStore({}),
      optOutStore: fakeOptOutStore(),
      logStore: fakeLogStore(capture.journal),
      originalNickStore: creerMemoryOriginalNickStore(),
      log: { warn: (message, contexte) => capture.warns.push({ message, contexte }) },
    });
    const oldMember = fakeMember({ roleIds: ["x"] });
    const newMember = {
      ...fakeMember({ roleIds: ["x", "role_cursive"] }),
      edit: () => {
        capture.editCalled = true;
        return Promise.resolve();
      },
    };
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
    expect(capture.warns.length).toBe(0);
  });

  // ---- Round-trip : restauration du pseudo d'origine (issue #25) ----

  it("au rename, MEMORISE le pseudo source avant stylisation (#25)", async () => {
    const nick = creerMemoryOriginalNickStore();
    const { gestionnaire, oldMember, newMember } = setup(
      { roleIds: ["x"], nickname: "bob", guildId: "g1", memberId: "m1" },
      { roleIds: ["x", "role_cursive"], nickname: "bob", guildId: "g1", memberId: "m1" },
      new Set(),
      nick,
    );
    await gestionnaire(oldMember as never, newMember as never);
    // Le pseudo SOURCE (avant stylisation) est memorise pour le round-trip.
    expect(await nick.get("g1", "m1")).toBe("bob");
  });

  it("retrait du DERNIER role mappe + pseudo memorise -> RESTAURE l original et oublie (#25)", async () => {
    const nick = creerMemoryOriginalNickStore();
    await nick.rememberIfAbsent("g1", "m1", "bob");
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x", "role_cursive"], nickname: "𝓑𝓸𝓫", guildId: "g1", memberId: "m1" },
      { roleIds: ["x"], nickname: "𝓑𝓸𝓫", guildId: "g1", memberId: "m1" },
      new Set(),
      nick,
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(true);
    expect(capture.editedNick).toBe("bob"); // pseudo d origine restaure tel quel
    expect(await nick.get("g1", "m1")).toBeNull(); // oublie apres restauration (D8)
  });

  it("retrait d UN role mappe mais il en reste un -> AUCUNE restauration (#25)", async () => {
    const nick = creerMemoryOriginalNickStore();
    await nick.rememberIfAbsent("g1", "m1", "bob");
    const { gestionnaire, oldMember, newMember, capture } = setup(
      {
        roleIds: ["role_cursive", "role_scriptify"],
        nickname: "𝓑𝓸𝓫",
        guildId: "g1",
        memberId: "m1",
      },
      { roleIds: ["role_scriptify"], nickname: "𝓑𝓸𝓫", guildId: "g1", memberId: "m1" },
      new Set(),
      nick,
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false); // encore stylise -> on ne restaure pas
    expect(await nick.get("g1", "m1")).toBe("bob"); // memoire conservee
  });

  it("retrait du dernier role mappe SANS pseudo memorise -> AUCUN edit (rien a restaurer)", async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x", "role_cursive"], guildId: "g1", memberId: "m1" },
      { roleIds: ["x"], guildId: "g1", memberId: "m1" },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
    expect(capture.warns.length).toBe(0);
  });
});

describe("adapter guildMemberUpdate — budget d'auto-rename borne (B2)", () => {
  /** Fabrique un couple (old, new) : le membre `id` gagne le role_cursive sur `guildId`. */
  function evenementGainRole(guildId: string, id: string, edits: string[]) {
    const old = fakeMember({ roleIds: ["x"], guildId, memberId: id, username: "abc" });
    const neuf = {
      ...fakeMember({ roleIds: ["x", "role_cursive"], guildId, memberId: id, username: "abc" }),
      edit: (data: { nick?: string | null }) => {
        edits.push(String(data.nick));
        return Promise.resolve();
      },
    };
    return { old, neuf };
  }

  it("sous rafale, ne depasse pas 10 renommages/min/guilde ; l'excedent est ignore et journalise", async () => {
    let t = 0;
    const budget = creerCompteurFenetre({ now: () => t, limite: 10, fenetreMs: 60_000 });
    const edits: string[] = [];
    const journal: AutoRenameLogEntry[] = [];
    const warns: Array<{ message: string; contexte: Record<string, unknown> }> = [];
    const gestionnaire = creerGestionnaireMembreMisAJour({
      store: fakeStore(MAPPING),
      optOutStore: fakeOptOutStore(),
      logStore: fakeLogStore(journal),
      originalNickStore: creerMemoryOriginalNickStore(),
      budgetStore: budget,
      log: { warn: (message, contexte) => warns.push({ message, contexte }) },
    });

    // 11 evenements sur la MEME guilde, dans la meme minute.
    for (let i = 0; i < 11; i++) {
      const { old, neuf } = evenementGainRole("g-rafale", `m${i}`, edits);
      await gestionnaire(old as never, neuf as never);
      t += 100;
    }

    expect(edits.length).toBe(10); // 10 renommages appliques, pas 11
    expect(journal.length).toBe(10); // seules les tentatives admises sont journalisees (#28)
    expect(warns.length).toBe(1); // l'excedent est JOURNALISE (log structure)
    expect(warns[0]!.contexte).toMatchObject({ guildId: "g-rafale" });
  });

  it("le budget est PAR GUILDE : une autre guilde garde son propre budget", async () => {
    let t = 0;
    const budget = creerCompteurFenetre({ now: () => t, limite: 10, fenetreMs: 60_000 });
    const edits: string[] = [];
    const journal: AutoRenameLogEntry[] = [];
    const warns: Array<{ message: string; contexte: Record<string, unknown> }> = [];
    const gestionnaire = creerGestionnaireMembreMisAJour({
      store: fakeStore(MAPPING),
      optOutStore: fakeOptOutStore(),
      logStore: fakeLogStore(journal),
      originalNickStore: creerMemoryOriginalNickStore(),
      budgetStore: budget,
      log: { warn: (message, contexte) => warns.push({ message, contexte }) },
    });
    // Epuise le budget de gA (10), puis un evenement sur gB doit passer.
    for (let i = 0; i < 10; i++) {
      const { old, neuf } = evenementGainRole("gA", `a${i}`, edits);
      await gestionnaire(old as never, neuf as never);
      t += 100;
    }
    const avant = edits.length;
    const { old, neuf } = evenementGainRole("gB", "b0", edits);
    await gestionnaire(old as never, neuf as never);
    expect(edits.length).toBe(avant + 1); // gB non impacte par la rafale de gA
  });
});

describe("adapter guildMemberUpdate — assainissement Unicode (B3)", () => {
  it("chemin AUTO-RENAME : un pseudo source avec zero-width/RTL est assaini avant edit", async () => {
    // nickname 'a<ZWSP>b<RTL>c' -> assaini 'abc' -> stylise 𝓐𝓫𝓬 ; aucun Cf/Cc a member.edit.
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ["x"], nickname: `a\u{200B}b\u{202E}c` },
      { roleIds: ["x", "role_cursive"], nickname: `a\u{200B}b\u{202E}c` },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editedNick).toBe("\u{1d4d0}\u{1d4eb}\u{1d4ec}"); // 𝓐𝓫𝓬
    expect([...String(capture.editedNick)].some((c) => /[\p{Cf}\p{Cc}]/u.test(c))).toBe(false);
  });
});
