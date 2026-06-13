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
import { describe, expect, it } from 'bun:test';
import { PermissionFlagsBits } from 'discord.js';
import { creerRenameCommand } from './rename';
import { creerMemoryOriginalNickStore } from '../original-nick/memory-store';
import type { OriginalNickStore } from '../original-nick/store';

interface Scenario {
  canManageNicknames?: boolean;
  manageable?: boolean;
  editThrows?: boolean;
  member?: { nick: string | null; name: string };
  style: string;
  nouveauNom?: string | null;
  duree?: string | null;
  store?: OriginalNickStore;
}

/** Commande par defaut (store memoire) pour les scenarios sans renommage temporaire. */
const renameCommand = creerRenameCommand(creerMemoryOriginalNickStore());

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
    id: 'm-cible',
    nickname: member.nick,
    user: { username: member.name },
    displayName: member.nick ?? member.name,
    guild: { id: 'g-test' },
    toString: () => '@cible',
    manageable: s.manageable ?? true,
    edit: (data: { nick?: string | null }) => {
      captured.editCalled = true;
      if (s.editThrows) return Promise.reject(new Error('Missing Permissions'));
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
      getString: (name: string) => {
        if (name === 'style') return s.style;
        if (name === 'duree') return s.duree ?? null;
        return s.nouveauNom ?? null;
      },
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

describe('commande /rename', () => {
  it('se nomme "rename", a une description et exige Manage Nicknames', () => {
    expect(renameCommand.data.name).toBe('rename');
    expect(renameCommand.data.description.length).toBeGreaterThan(0);
    // La permission par defaut est cablee sur la commande (defense en profondeur).
    const json = renameCommand.data.toJSON();
    expect(json.default_member_permissions).toBe(PermissionFlagsBits.ManageNicknames.toString());
  });

  it('renomme le membre avec le pseudo stylise et confirme par un embed', async () => {
    const { interaction, captured } = fakeInteraction({ style: 'cursive', nouveauNom: 'abc' });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(true);
    expect(captured.edited).toBe('\u{1d4d0}\u{1d4eb}\u{1d4ec}'); // 𝓐𝓫𝓬
    expect(captured.embeds.length).toBe(1);
    expect(captured.ephemeral).toBe(false);
  });

  it('utilise nick||name quand aucun nouveau_nom (source = nick prioritaire)', async () => {
    const { interaction, captured } = fakeInteraction({
      style: 'cursive',
      member: { nick: 'bob', name: 'globalname' },
    });
    await renameCommand.execute(interaction);
    expect(captured.edited).toBe('\u{1d4d1}\u{1d4f8}\u{1d4eb}'); // 𝓑𝓸𝓫 (Bob stylise)
  });

  it('permission appelant manquante -> ephemere, AUCUN edit', async () => {
    const { interaction, captured } = fakeInteraction({
      style: 'cursive',
      nouveauNom: 'abc',
      canManageNicknames: false,
    });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('permission');
  });

  it('style inconnu -> refus propre ephemere, AUCUN edit', async () => {
    const { interaction, captured } = fakeInteraction({ style: 'inexistant', nouveauNom: 'abc' });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('inconnu');
  });

  it('texte deja stylise -> refus propre ephemere, AUCUN edit', async () => {
    const deja = '\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}'; // 𝓗𝓮𝓵𝓵𝓸
    const { interaction, captured } = fakeInteraction({ style: 'cursive', nouveauNom: deja });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('déjà stylisé');
  });

  it('hierarchie de roles (membre non gerable) -> ephemere, AUCUN edit', async () => {
    const { interaction, captured } = fakeInteraction({
      style: 'cursive',
      nouveauNom: 'abc',
      manageable: false,
    });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('hiérarchie');
  });

  it('edit qui echoue (Forbidden bot) -> ephemere, pas de crash', async () => {
    const { interaction, captured } = fakeInteraction({
      style: 'cursive',
      nouveauNom: 'abc',
      editThrows: true,
    });
    await renameCommand.execute(interaction);
    expect(captured.editCalled).toBe(true);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('permission');
  });
});

describe('commande /rename — renommage temporaire (issue #38)', () => {
  it('expose une option duree optionnelle', () => {
    const json = creerRenameCommand(creerMemoryOriginalNickStore()).data.toJSON();
    const duree = json.options?.find((o) => o.name === 'duree');
    expect(duree).toBeDefined();
    expect(duree?.required ?? false).toBe(false);
  });

  it('avec duree valide : memorise le pseudo source pour auto-revert, renomme, confirme', async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCommand(store);
    const { interaction, captured } = fakeInteraction({
      store,
      style: 'cursive',
      member: { nick: 'Bob', name: 'globalname' },
      duree: '2h',
    });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(true);
    // Le pseudo SOURCE (Bob) est memorise pour la restauration a l echeance.
    expect(await store.get('g-test', 'm-cible')).toBe('Bob');
    expect(await store.listDue(Number.MAX_SAFE_INTEGER)).toHaveLength(1);
    expect(captured.embeds.length).toBe(1);
  });

  it('sans duree : NE memorise PAS d echeance (renommage permanent classique)', async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCommand(store);
    const { interaction } = fakeInteraction({ store, style: 'cursive', nouveauNom: 'abc' });
    await command.execute(interaction);
    expect(await store.listDue(Number.MAX_SAFE_INTEGER)).toHaveLength(0);
  });

  it('duree invalide -> refus propre ephemere, AUCUN edit', async () => {
    const store = creerMemoryOriginalNickStore();
    const command = creerRenameCommand(store);
    const { interaction, captured } = fakeInteraction({
      store,
      style: 'cursive',
      nouveauNom: 'abc',
      duree: 'n importe quoi',
    });
    await command.execute(interaction);
    expect(captured.editCalled).toBe(false);
    expect(captured.ephemeral).toBe(true);
    expect(captured.content.toLowerCase()).toContain('durée');
  });
});
