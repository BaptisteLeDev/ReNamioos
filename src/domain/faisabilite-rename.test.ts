/**
 * Test du predicat PUR de faisabilite d'un auto-rename (#29).
 *
 * Quand un admin mappe un role a un style (/auto-rename add), on veut PREVENIR
 * (sans bloquer) si le bot ne pourra pas renommer les membres de ce role. Memes
 * controles que appliquerRename, mais evalues a l'AJOUT, par anticipation :
 *  - le bot doit avoir la permission Manage Nicknames ;
 *  - le role cible doit etre SOUS le role le plus haut du bot (sinon hierarchie).
 *
 * Predicat PUR : prend des primitives (permission booleenne, positions de role),
 * renvoie un Result discrimine. Aucun import discord.js, teste en memoire.
 */
import { describe, expect, it } from 'bun:test';
import { evaluerFaisabiliteRename } from './faisabilite-rename';

describe('evaluerFaisabiliteRename', () => {
  it('OK quand le bot a la permission ET son role est au-dessus du role cible', () => {
    const r = evaluerFaisabiliteRename({
      botPeutGererPseudos: true,
      positionRoleBot: 10,
      positionRoleCible: 5,
    });
    expect(r.ok).toBe(true);
  });

  it('refuse si la permission Manage Nicknames manque', () => {
    const r = evaluerFaisabiliteRename({
      botPeutGererPseudos: false,
      positionRoleBot: 10,
      positionRoleCible: 5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe('permission-manquante');
  });

  it('refuse si le role cible est AU-DESSUS du role du bot', () => {
    const r = evaluerFaisabiliteRename({
      botPeutGererPseudos: true,
      positionRoleBot: 5,
      positionRoleCible: 10,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe('role-trop-haut');
  });

  it('refuse si le role cible est a EGALITE de position avec le role du bot', () => {
    const r = evaluerFaisabiliteRename({
      botPeutGererPseudos: true,
      positionRoleBot: 5,
      positionRoleCible: 5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe('role-trop-haut');
  });

  it('priorise la permission manquante quand les deux problemes coexistent', () => {
    const r = evaluerFaisabiliteRename({
      botPeutGererPseudos: false,
      positionRoleBot: 1,
      positionRoleCible: 9,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe('permission-manquante');
  });
});
