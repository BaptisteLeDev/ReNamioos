/**
 * Logique PURE du renommage temporaire / programme (issue #38).
 *
 * Deux responsabilites pures, sans I/O ni Discord :
 *  1. PARSER une duree saisie (`2h`, `30m`, `7j`, `24h`...) ou une date ISO en une
 *     ECHEANCE absolue (epoch ms) a partir d'un `maintenant` injecte.
 *  2. DECIDER « faut-il reverter maintenant » : une echeance est echue si elle est
 *     <= maintenant. C'est le predicat que le job de balayage applique a chaque ligne.
 */
import { describe, expect, it } from 'bun:test';
import { parserEcheance, estEchu } from './rename-temporaire';

const MAINTENANT = Date.parse('2026-06-13T12:00:00.000Z');

describe('parserEcheance — duree relative', () => {
  it('parse 2h en maintenant + 2 heures', () => {
    const r = parserEcheance('2h', MAINTENANT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.expiresAt).toBe(MAINTENANT + 2 * 3_600_000);
  });

  it('parse 30m, 24h, 7j', () => {
    expect((parserEcheance('30m', MAINTENANT) as { ok: true; expiresAt: number }).expiresAt).toBe(
      MAINTENANT + 30 * 60_000,
    );
    expect((parserEcheance('24h', MAINTENANT) as { ok: true; expiresAt: number }).expiresAt).toBe(
      MAINTENANT + 24 * 3_600_000,
    );
    expect((parserEcheance('7j', MAINTENANT) as { ok: true; expiresAt: number }).expiresAt).toBe(
      MAINTENANT + 7 * 86_400_000,
    );
  });

  it('tolere les espaces et la casse (« 2H », « 2 h »)', () => {
    expect((parserEcheance(' 2H ', MAINTENANT) as { ok: true; expiresAt: number }).expiresAt).toBe(
      MAINTENANT + 2 * 3_600_000,
    );
  });

  it('refuse une duree nulle ou negative', () => {
    expect(parserEcheance('0h', MAINTENANT).ok).toBe(false);
    expect(parserEcheance('-1h', MAINTENANT).ok).toBe(false);
  });

  it('refuse une unite inconnue ou une saisie vide', () => {
    expect(parserEcheance('2x', MAINTENANT).ok).toBe(false);
    expect(parserEcheance('abc', MAINTENANT).ok).toBe(false);
    expect(parserEcheance('', MAINTENANT).ok).toBe(false);
  });

  it('refuse une duree depassant le plafond (anti-echeance absurde)', () => {
    expect(parserEcheance('9999j', MAINTENANT).ok).toBe(false);
  });
});

describe('parserEcheance — date absolue', () => {
  it('parse une date ISO future', () => {
    const r = parserEcheance('2026-06-14T12:00:00.000Z', MAINTENANT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.expiresAt).toBe(Date.parse('2026-06-14T12:00:00.000Z'));
  });

  it('refuse une date dans le passe', () => {
    expect(parserEcheance('2020-01-01T00:00:00.000Z', MAINTENANT).ok).toBe(false);
  });
});

describe('estEchu — predicat de revert', () => {
  it('vrai si l echeance est passee', () => {
    expect(estEchu(MAINTENANT - 1, MAINTENANT)).toBe(true);
  });

  it('vrai a l instant exact de l echeance (<=)', () => {
    expect(estEchu(MAINTENANT, MAINTENANT)).toBe(true);
  });

  it('faux si l echeance est dans le futur', () => {
    expect(estEchu(MAINTENANT + 1, MAINTENANT)).toBe(false);
  });
});
