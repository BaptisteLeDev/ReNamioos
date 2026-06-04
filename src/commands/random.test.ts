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
import { describe, expect, it } from 'bun:test';
import { PermissionFlagsBits } from 'discord.js';
import { randomCommand } from './random';

interface Scenario {
  canManageNicknames?: boolean;
  manageable?: boolean;
  member?: { nick: string | null; name: string };
  nouveauNom?: string | null;
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
    content: '',
    ephemeral: false,
    embeds: [],
  };
  const member = s.member ?? { nick: null, name: 'renamio' };
  const targetMember = {
    nickname: member.nick,
    user: { username: member.name },
    displayName: member.nick ?? member.name,
    toString: () => '@cible',
    manageable: s.manageable ?? true,
    edit: (data: { nick?: string | null }) => {
      captured.editCalled = true;
      captured.edited = data.nick;
      return Promise.resolve();
    },
  };
  const interaction = {
    memberPermissions: {
      has: (perm: bigint) =>
        perm === PermissionFlagsBits.ManageNicknames ? (s.canManageNicknames ?? true) : false,
    },
    options: {
      getMember: () => targetMember,
      getString: () => s.nouveauNom ?? null,
    },
    reply: (payload: { content?: string; ephemeral?: boolean; embeds?: unknown[] }) => {
      captured.content = payload.content ?? '';
      captured.ephemeral = payload.ephemeral ?? false;
      captured.embeds = payload.embeds ?? [];
      return Promise.resolve();
    },
  } as never;
  return { interaction, captured };
}

describe('commande /random', () => {
  it('se nomme "random", a une description et exige Manage Nicknames', () => {
    expect(randomCommand.data.name).toBe('random');
    expect(randomCommand.data.description.length).toBeGreaterThan(0);
    const json = randomCommand.data.toJSON();
    expect(json.default_member_permissions).toBe(PermissionFlagsBits.ManageNicknames.toString());
  });

  it('renomme avec un style aleatoire (sortie non vide, != source) et confirme', async () => {
    const { interaction, captured } = fakeInteraction({ nouveauNom: 'renamio' });
    await randomCommand.execute(interaction);
    expect(captured.editCalled).toBe(true);
    expect(captured.edited).toBeTruthy();
    expect(captured.edited).not.toBe('renamio'); // un vrai rendu stylise
    expect(captured.embeds.length).toBe(1);
  });

  it('permission appelant manquante -> ephemere, AUCUN edit', async () => {
    const { interaction, captured } = fakeInteraction({
      nouveauNom: 'abc',
      canManageNicknames: false,
    });
    await randomCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('permission');
  });

  it('texte deja stylise -> refus propre ephemere, AUCUN edit', async () => {
    const deja = '\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}'; // 𝓗𝓮𝓵𝓵𝓸
    const { interaction, captured } = fakeInteraction({ nouveauNom: deja });
    await randomCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('déjà stylisé');
  });

  it('hierarchie de roles (membre non gerable) -> ephemere, AUCUN edit', async () => {
    const { interaction, captured } = fakeInteraction({ nouveauNom: 'abc', manageable: false });
    await randomCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('hiérarchie');
  });
});
