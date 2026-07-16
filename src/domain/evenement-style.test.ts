/**
 * Domaine PUR de l'evenement stylise (« Style Party ») — aucune dependance discord.js.
 *
 * Un admin programme une periode pendant laquelle les membres d'un role sont stylises, avec
 * revert auto a la fin. Ce module ne porte que les DECISIONS pures : invariant d'agrégat (un
 * seul event actif par guilde) et eligibilite d'un membre (bot / hierarchie / opt-out).
 */
import { describe, expect, it } from "bun:test";
import {
  estMembreStylisable,
  peutDemarrer,
  type EvenementStyle,
} from "./evenement-style";

const EVENT: EvenementStyle = {
  guildId: "g1",
  roleId: "r1",
  style: "gothique",
  startedAt: 1000,
  expiresAt: 1000 + 3_600_000,
};

describe("peutDemarrer — invariant d agrégat (un seul event actif par guilde)", () => {
  it("aucun event actif -> on peut demarrer", () => {
    expect(peutDemarrer(null)).toBe(true);
  });
  it("un event deja actif -> on NE peut PAS demarrer (interdit deux events simultanes)", () => {
    expect(peutDemarrer(EVENT)).toBe(false);
  });
});

describe("estMembreStylisable — filtre pur des cibles d un event", () => {
  it("membre humain, manageable, non opt-out -> stylisable", () => {
    expect(estMembreStylisable({ estBot: false, manageable: true, estOptOut: false })).toBe(true);
  });
  it("bot -> ignore", () => {
    expect(estMembreStylisable({ estBot: true, manageable: true, estOptOut: false })).toBe(false);
  });
  it("non manageable (hierarchie) -> ignore", () => {
    expect(estMembreStylisable({ estBot: false, manageable: false, estOptOut: false })).toBe(false);
  });
  it("opt-out -> ignore strictement (respect du consentement)", () => {
    expect(estMembreStylisable({ estBot: false, manageable: true, estOptOut: true })).toBe(false);
  });
});
