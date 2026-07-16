/**
 * Test d'acceptation de /rename-pending (issue #46, scenario F1).
 *
 * Liste les renommages temporaires A VENIR de la guilde courante (membre, pseudo original a
 * restaurer, date d'expiration), tries par echeance. Aucune echeance => message clair.
 * Meme garde de permission que le reste de l'admin rename (Manage Nicknames), refus ephemere.
 */
import { describe, expect, it } from "bun:test";
import { PermissionFlagsBits } from "discord.js";
import { creerRenamePendingCommand } from "./rename-pending";
import { creerMemoryOriginalNickStore } from "../original-nick/memory-store";
import type { OriginalNickStore } from "../original-nick/store";

interface Scenario {
  canManageNicknames?: boolean;
  guildId?: string;
  store: OriginalNickStore;
}

interface Captured {
  content: string;
  ephemeral: boolean;
}

function fakeInteraction(s: Scenario) {
  const captured: Captured = { content: "", ephemeral: false };
  const interaction = {
    guildId: s.guildId ?? "g-test",
    memberPermissions: {
      has: (perm: bigint) =>
        perm === PermissionFlagsBits.ManageNicknames ? (s.canManageNicknames ?? true) : false,
    },
    reply: (payload: { content?: string; ephemeral?: boolean }) => {
      captured.content = payload.content ?? "";
      captured.ephemeral = payload.ephemeral ?? false;
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

describe("commande /rename-pending", () => {
  it('se nomme "rename-pending" et exige Manage Nicknames', () => {
    const command = creerRenamePendingCommand(creerMemoryOriginalNickStore());
    expect(command.data.name).toBe("rename-pending");
    expect(command.data.description.length).toBeGreaterThan(0);
    const json = command.data.toJSON();
    expect(json.default_member_permissions).toBe(PermissionFlagsBits.ManageNicknames.toString());
  });

  it("permission appelant manquante -> ephemere, message clair", async () => {
    const command = creerRenamePendingCommand(creerMemoryOriginalNickStore());
    const { interaction, captured } = fakeInteraction({
      store: creerMemoryOriginalNickStore(),
      canManageNicknames: false,
    });
    await command.execute(interaction);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain("permission");
  });

  it("aucune echeance a venir -> message clair", async () => {
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g-test", "m1", "RoleOnly"); // sans echeance, jamais pending
    const command = creerRenamePendingCommand(store);
    const { interaction, captured } = fakeInteraction({ store });
    await command.execute(interaction);
    expect(captured.content.toLowerCase()).toContain("aucun");
  });

  it("liste les echeances A VENIR de CETTE guilde, triees par echeance", async () => {
    const maintenant = 1_000_000;
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g-test", "tardif", "Zoe", maintenant + 100_000);
    await store.rememberIfAbsent("g-test", "tot", "Bob", maintenant + 10_000);
    await store.rememberIfAbsent("g-test", "role", "RoleOnly"); // exclu (pas d echeance)
    await store.rememberIfAbsent("autre", "ailleurs", "Ailleurs", maintenant + 5_000); // autre guilde
    const command = creerRenamePendingCommand(store, () => maintenant);
    const { interaction, captured } = fakeInteraction({ store });
    await command.execute(interaction);

    // Les deux membres temporaires de g-test apparaissent, l autre guilde non.
    expect(captured.content).toContain("<@tot>");
    expect(captured.content).toContain("<@tardif>");
    expect(captured.content).not.toContain("<@ailleurs>");
    expect(captured.content).not.toContain("<@role>");
    // Les pseudos originaux (a restaurer) sont montres.
    expect(captured.content).toContain("Bob");
    expect(captured.content).toContain("Zoe");
    // Tri par echeance : la plus proche (tot) avant la plus lointaine (tardif).
    expect(captured.content.indexOf("<@tot>")).toBeLessThan(captured.content.indexOf("<@tardif>"));
    // Une date d expiration (timestamp Discord) accompagne chaque ligne.
    expect(captured.content).toContain("<t:");
  });

  it("borne l'affichage sous la limite Discord de 2000 caracteres et signale le reste", async () => {
    const maintenant = 1_000_000;
    const store = creerMemoryOriginalNickStore();
    const total = 60;
    for (let i = 0; i < total; i++) {
      await store.rememberIfAbsent(
        "g-test",
        `membre-${i}`,
        "PseudoOriginalAssezLongPourRemplir",
        maintenant + (i + 1) * 1_000,
      );
    }
    const command = creerRenamePendingCommand(store, () => maintenant);
    const { interaction, captured } = fakeInteraction({ store });
    await command.execute(interaction);

    // Le contenu ne depasse jamais la limite Discord (sinon reply leverait un DiscordAPIError).
    expect(captured.content.length).toBeLessThanOrEqual(2000);
    // Le total reel reste annonce dans l'entete, et un reste non affiche est signale.
    expect(captured.content).toContain(`(${total})`);
    expect(captured.content.toLowerCase()).toContain("autre");
  });

  it("exclut les echeances DEJA echues (celles-ci sont du ressort du job de balayage)", async () => {
    const maintenant = 1_000_000;
    const store = creerMemoryOriginalNickStore();
    await store.rememberIfAbsent("g-test", "echu", "Passe", maintenant - 1); // deja echu
    const command = creerRenamePendingCommand(store, () => maintenant);
    const { interaction, captured } = fakeInteraction({ store });
    await command.execute(interaction);
    expect(captured.content.toLowerCase()).toContain("aucun");
    expect(captured.content).not.toContain("<@echu>");
  });
});
