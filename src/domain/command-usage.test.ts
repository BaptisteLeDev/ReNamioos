/**
 * Tests de la logique PURE du suivi d'usage des commandes (issue #27).
 *
 * `agregerCommandsDaily` produit la serie `commandsDaily` du contrat /stats : les 30
 * derniers jours (UTC) ayant au moins une commande, triee par jour ascendant. Teste les
 * cas frontiere : vide, multi-jours, et exclusion de ce qui depasse la fenetre de 30 jours.
 */
import { describe, expect, it } from 'bun:test';
import { agregerCommandsDaily, cleJourUtc, type CompteJournalier } from './command-usage';

const MAINTENANT = new Date('2026-06-12T10:00:00Z');

describe('agregerCommandsDaily', () => {
  it('renvoie [] quand aucun jour enregistre', () => {
    expect(agregerCommandsDaily([], MAINTENANT)).toEqual([]);
  });

  it('renvoie les jours tries en ordre ascendant', () => {
    const comptes: CompteJournalier[] = [
      { day: '2026-06-12', count: 5 },
      { day: '2026-06-10', count: 2 },
      { day: '2026-06-11', count: 3 },
    ];
    expect(agregerCommandsDaily(comptes, MAINTENANT)).toEqual([
      { day: '2026-06-10', count: 2 },
      { day: '2026-06-11', count: 3 },
      { day: '2026-06-12', count: 5 },
    ]);
  });

  it('exclut les jours hors de la fenetre des 30 derniers jours (UTC)', () => {
    const comptes: CompteJournalier[] = [
      { day: '2026-06-12', count: 1 }, // aujourd'hui : inclus
      { day: '2026-05-14', count: 4 }, // J-29 : inclus (30 jours glissants)
      { day: '2026-05-13', count: 9 }, // J-30 : exclu
      { day: '2026-01-01', count: 7 }, // bien trop vieux : exclu
    ];
    expect(agregerCommandsDaily(comptes, MAINTENANT)).toEqual([
      { day: '2026-05-14', count: 4 },
      { day: '2026-06-12', count: 1 },
    ]);
  });

  it('ne fabrique pas de jours a zero : seuls les jours observes apparaissent', () => {
    const comptes: CompteJournalier[] = [{ day: '2026-06-12', count: 3 }];
    const out = agregerCommandsDaily(comptes, MAINTENANT);
    expect(out).toEqual([{ day: '2026-06-12', count: 3 }]);
  });
});

describe('cleJourUtc', () => {
  it('derive AAAA-MM-JJ en UTC, sans glissement de fuseau', () => {
    expect(cleJourUtc(new Date('2026-06-12T23:59:59Z'))).toBe('2026-06-12');
    expect(cleJourUtc(new Date('2026-06-12T00:00:00Z'))).toBe('2026-06-12');
  });
});
