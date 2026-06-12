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
import { describe, expect, it } from 'bun:test';
import type { MappingRoleStyle } from '../domain/auto-rename';
import type { MappingStore } from '../mapping/store';
import type { OptOutStore } from '../optout/store';
import { creerGestionnaireMembreMisAJour } from './guild-member-update';

const MAPPING: MappingRoleStyle = {
  role_cursive: 'cursive',
  role_scriptify: 'scriptify',
};

/**
 * Store FAKE en lecture seule : meme mapping pour toute guild (B8). L'adapter lit la
 * provenance via store.list(guildId) ; le domaine pur reste inchange (ADR-0004).
 */
function fakeStore(mapping: MappingRoleStyle): MappingStore {
  return {
    styleForRole: (_g, r) => Promise.resolve(mapping[r] ?? null),
    add: () => Promise.reject(new Error('lecture seule (test)')),
    remove: () => Promise.reject(new Error('lecture seule (test)')),
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
    guild: { id: m.guildId ?? 'guild-1' },
    id: m.memberId ?? 'member-1',
    nickname: m.nickname ?? null,
    user: { username: m.username ?? 'globalname' },
    manageable: m.manageable ?? true,
    roles: { cache: new Map(m.roleIds.map((id) => [id, { id }])) },
  };
}

function setup(old: MembreFake, neuf: MembreFake, optOut: Set<string> = new Set()) {
  const capture: Capture = { editCalled: false, editedNick: undefined, warns: [] };
  const oldMember = fakeMember(old);
  const newMember = {
    ...fakeMember(neuf),
    edit: (data: { nick?: string | null }) => {
      capture.editCalled = true;
      if (neuf.editThrows) return Promise.reject(new Error('Missing Permissions'));
      capture.editedNick = data.nick;
      return Promise.resolve();
    },
  };
  const gestionnaire = creerGestionnaireMembreMisAJour({
    store: fakeStore(MAPPING),
    optOutStore: fakeOptOutStore(optOut),
    log: {
      warn: (message, contexte) => capture.warns.push({ message, contexte }),
    },
  });
  return { gestionnaire, oldMember, newMember, capture };
}

describe('adapter guildMemberUpdate — auto-rename', () => {
  it('role mappe ajoute -> stylise le pseudo SERVEUR (nickname prioritaire, ECART B6)', async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['x'], nickname: 'bob', username: 'globalname' },
      { roleIds: ['x', 'role_cursive'], nickname: 'bob', username: 'globalname' },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(true);
    // 'Bob' stylise en cursive (source = nickname 'bob', PAS 'globalname').
    expect(capture.editedNick).toBe('\u{1d4d1}\u{1d4f8}\u{1d4eb}'); // 𝓑𝓸𝓫
  });

  it('source = nom global quand AUCUN nickname serveur', async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['x'], nickname: null, username: 'abc' },
      { roleIds: ['x', 'role_cursive'], nickname: null, username: 'abc' },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editedNick).toBe('\u{1d4d0}\u{1d4eb}\u{1d4ec}'); // 𝓐𝓫𝓬
  });

  it('aucun role mappe ajoute -> AUCUN edit, AUCUN warn', async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['x'] },
      { roleIds: ['x', 'role_non_mappe'] },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
    expect(capture.warns.length).toBe(0);
  });

  it('role mappe RETIRE -> AUCUN edit (seuls les ajouts declenchent)', async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['x', 'role_cursive'] },
      { roleIds: ['x'] },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
  });

  it('echange simultane cardinalite egale (gain mappe) -> declenche (ECART B6)', async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['role_perdu'], username: 'abc' },
      { roleIds: ['role_cursive'], username: 'abc' },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(true);
    expect(capture.editedNick).toBe('\u{1d4d0}\u{1d4eb}\u{1d4ec}'); // 𝓐𝓫𝓬
  });

  it('hierarchie (membre non gerable) -> LOG STRUCTURE warn, aucune exception', async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['x'], username: 'abc' },
      { roleIds: ['x', 'role_cursive'], username: 'abc', manageable: false, guildId: 'g7', memberId: 'm9' },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.warns.length).toBe(1);
    expect(capture.warns[0]!.contexte).toMatchObject({ guildId: 'g7', memberId: 'm9', style: 'cursive' });
  });

  it('edit Discord echoue (Forbidden bot) -> LOG STRUCTURE warn, pas de crash', async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['x'], username: 'abc' },
      { roleIds: ['x', 'role_cursive'], username: 'abc', editThrows: true, guildId: 'g1', memberId: 'm1' },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(true);
    expect(capture.warns.length).toBe(1);
    expect(capture.warns[0]!.contexte).toMatchObject({ guildId: 'g1', memberId: 'm1', style: 'cursive' });
  });

  it('refus propre du domaine (deja stylise) -> LOG STRUCTURE warn, AUCUN edit reussi', async () => {
    const deja = '\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}'; // 𝓗𝓮𝓵𝓵𝓸 (deja stylise)
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['x'], nickname: deja },
      { roleIds: ['x', 'role_cursive'], nickname: deja, guildId: 'gz', memberId: 'mz' },
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
    expect(capture.warns.length).toBe(1);
    expect(capture.warns[0]!.contexte).toMatchObject({ guildId: 'gz', memberId: 'mz', style: 'cursive' });
  });

  it('membre OPT-OUT + role mappe ajoute -> AUCUN edit (consentement refuse, issue #27)', async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['x'], nickname: 'bob' },
      { roleIds: ['x', 'role_cursive'], nickname: 'bob', guildId: 'g1', memberId: 'm-opt' },
      new Set(['g1:m-opt']),
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
    expect(capture.warns.length).toBe(0); // refus de consentement = normal, pas un echec
  });

  it('opt-out CIBLE : un autre membre NON opt-out est bien renomme', async () => {
    const { gestionnaire, oldMember, newMember, capture } = setup(
      { roleIds: ['x'], nickname: 'bob' },
      { roleIds: ['x', 'role_cursive'], nickname: 'bob', guildId: 'g1', memberId: 'm-ok' },
      new Set(['g1:un-autre']),
    );
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(true);
  });

  it('mapping vide -> jamais d auto-rename', async () => {
    const capture: Capture = { editCalled: false, editedNick: undefined, warns: [] };
    const gestionnaire = creerGestionnaireMembreMisAJour({
      store: fakeStore({}),
      optOutStore: fakeOptOutStore(),
      log: { warn: (message, contexte) => capture.warns.push({ message, contexte }) },
    });
    const oldMember = fakeMember({ roleIds: ['x'] });
    const newMember = { ...fakeMember({ roleIds: ['x', 'role_cursive'] }), edit: () => {
      capture.editCalled = true;
      return Promise.resolve();
    } };
    await gestionnaire(oldMember as never, newMember as never);
    expect(capture.editCalled).toBe(false);
    expect(capture.warns.length).toBe(0);
  });
});
