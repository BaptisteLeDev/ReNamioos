/**
 * Harnais d'acceptation du domaine PUR de l'auto-rename (B6, ADR-0004).
 *
 * Aucune dependance a discord.js : on raisonne sur des ENSEMBLES d'identifiants
 * de roles (string) et un mapping ORDONNE roleId -> style. La logique repond a
 * une seule question metier : « quel style appliquer, le cas echeant, suite a un
 * changement de roles ? ». L'adapter Discord (src/events) traduit les objets
 * Discord vers ces primitives et applique le rename.
 *
 * ECARTS VOLONTAIRES B6 vs comportement pinne legacy (cf. docs/caracterisation.md
 * § Auto-rename, bug n°7) :
 *  - DETECTION PAR DIFF D'ENSEMBLES (et non par cardinalite). Un echange simultane
 *    (un role gagne + un perdu, meme cardinalite) declenche desormais : seuls les
 *    roles AJOUTES sont des declencheurs.
 */
import { describe, expect, it } from 'bun:test';
import {
  styleDeclenche,
  rolesAjoutes,
  styleAvecConsentement,
  aPerduDernierRoleMappe,
  type MappingRoleStyle,
} from './auto-rename';

/** Mapping ordonne d'exemple : l'ordre des cles = priorite (ADR-0004). */
const MAPPING: MappingRoleStyle = {
  role_cursive: 'cursive',
  role_scriptify: 'scriptify',
  role_gothique: 'gothique',
};

describe('rolesAjoutes — diff d ensembles (ECART VOLONTAIRE B6)', () => {
  it('retourne les roles presents dans apres mais absents d avant', () => {
    expect(rolesAjoutes(['a', 'b'], ['a', 'b', 'c'])).toEqual(['c']);
  });

  it('aucun ajout -> tableau vide (meme si des roles sont retires)', () => {
    expect(rolesAjoutes(['a', 'b', 'c'], ['a'])).toEqual([]);
  });

  it('echange simultane a cardinalite EGALE : detecte le role gagne', () => {
    // Un role perdu (b) + un gagne (c), |avant| == |apres|. Le legacy ne
    // declenchait RIEN (detection par cardinalite). B6 detecte l ajout de c.
    expect(rolesAjoutes(['a', 'b'], ['a', 'c'])).toEqual(['c']);
  });

  it('preserve l ordre d apparition dans apres (pour la priorite)', () => {
    expect(rolesAjoutes(['x'], ['x', 'role_gothique', 'role_cursive'])).toEqual([
      'role_gothique',
      'role_cursive',
    ]);
  });
});

describe('styleDeclenche — quel style appliquer suite a un changement de roles', () => {
  it('un role mappe ajoute -> son style', () => {
    expect(styleDeclenche(['x'], ['x', 'role_cursive'], MAPPING)).toBe('cursive');
  });

  it('aucun role ajoute -> null (pas de rename)', () => {
    expect(styleDeclenche(['role_cursive'], ['role_cursive'], MAPPING)).toBeNull();
  });

  it('role ajoute NON mappe -> null', () => {
    expect(styleDeclenche(['x'], ['x', 'role_inconnu'], MAPPING)).toBeNull();
  });

  it('role retire (meme mappe) -> null : seuls les AJOUTS declenchent', () => {
    expect(styleDeclenche(['role_cursive', 'x'], ['x'], MAPPING)).toBeNull();
  });

  it('PRIORITE : plusieurs roles mappes gagnes -> ordre du MAPPING (fichier) gagne', () => {
    // Le membre gagne role_gothique ET role_cursive d un coup. Dans le mapping,
    // role_cursive est declare AVANT role_gothique -> cursive l emporte, quel que
    // soit l ordre d apparition dans apres.
    expect(styleDeclenche([], ['role_gothique', 'role_cursive'], MAPPING)).toBe('cursive');
  });

  it('PRIORITE stable meme si l ordre dans apres differe', () => {
    expect(styleDeclenche([], ['role_cursive', 'role_gothique'], MAPPING)).toBe('cursive');
  });

  it('scriptify est un style mappable de plein droit (semantique role.json legacy)', () => {
    expect(styleDeclenche([], ['role_scriptify'], MAPPING)).toBe('scriptify');
  });

  it('echange simultane cardinalite egale avec role mappe gagne -> declenche (ECART B6)', () => {
    expect(styleDeclenche(['role_perdu'], ['role_cursive'], MAPPING)).toBe('cursive');
  });
});

describe('styleAvecConsentement — faut-il appliquer l auto-rename ? (issue #27)', () => {
  it('membre NON opt-out + style declenche -> applique le style', () => {
    expect(styleAvecConsentement('cursive', false)).toBe('cursive');
  });

  it('membre opt-out + style declenche -> null (refus de consentement, pas de rename)', () => {
    expect(styleAvecConsentement('cursive', true)).toBeNull();
  });

  it('aucun style declenche + non opt-out -> null (rien a faire)', () => {
    expect(styleAvecConsentement(null, false)).toBeNull();
  });

  it('aucun style declenche + opt-out -> null', () => {
    expect(styleAvecConsentement(null, true)).toBeNull();
  });
});

describe('aPerduDernierRoleMappe — faut-il restaurer le pseudo d origine ? (issue #25)', () => {
  it('perd son SEUL role mappe -> true (plus aucun mappe, restauration due)', () => {
    expect(aPerduDernierRoleMappe(['role_cursive', 'x'], ['x'], MAPPING)).toBe(true);
  });

  it('perd un role mappe mais en garde un autre -> false (encore stylise)', () => {
    expect(
      aPerduDernierRoleMappe(['role_cursive', 'role_gothique'], ['role_gothique'], MAPPING),
    ).toBe(false);
  });

  it('ne perd aucun role mappe (perd un role non mappe) -> false', () => {
    expect(aPerduDernierRoleMappe(['role_cursive', 'x'], ['role_cursive'], MAPPING)).toBe(false);
  });

  it('n avait aucun role mappe -> false (rien a restaurer)', () => {
    expect(aPerduDernierRoleMappe(['x', 'y'], ['x'], MAPPING)).toBe(false);
  });

  it('gagne un role (aucun retrait) -> false : ce n est pas un retrait', () => {
    expect(aPerduDernierRoleMappe(['x'], ['x', 'role_cursive'], MAPPING)).toBe(false);
  });

  it('echange : perd son dernier mappe ET gagne un non-mappe -> true', () => {
    expect(aPerduDernierRoleMappe(['role_cursive'], ['autre'], MAPPING)).toBe(true);
  });

  it('echange : perd un mappe mais en GAGNE un autre mappe -> false (toujours stylise)', () => {
    expect(aPerduDernierRoleMappe(['role_cursive'], ['role_gothique'], MAPPING)).toBe(false);
  });
});
