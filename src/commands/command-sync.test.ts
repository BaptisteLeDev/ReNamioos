/**
 * Test unitaire du diff PUR de synchronisation des commandes (/update).
 * Aucune I/O Discord ni DB : la logique "disponibles vs nouvelles" se verifie en memoire.
 */
import { describe, expect, it } from 'bun:test';
import { diffCommands } from './command-sync';

describe('diffCommands', () => {
  it('marque tout comme nouveau quand le serveur n’a jamais synchronise', () => {
    const out = diffCommands(['ping', 'aide'], []);
    expect(out.available).toEqual(['aide', 'ping']);
    expect(out.added).toEqual(['aide', 'ping']);
  });

  it('ne marque comme nouvelles que les commandes absentes de la derniere synchro', () => {
    const out = diffCommands(['ping', 'aide', 'update'], ['ping', 'aide']);
    expect(out.added).toEqual(['update']);
  });

  it('renvoie added vide quand rien n’a change', () => {
    const out = diffCommands(['ping', 'aide'], ['aide', 'ping']);
    expect(out.added).toEqual([]);
  });

  it('ignore les commandes retirees (known plus large que available)', () => {
    const out = diffCommands(['ping'], ['ping', 'aide']);
    expect(out.available).toEqual(['ping']);
    expect(out.added).toEqual([]);
  });

  it('trie et deduplique la liste disponible', () => {
    const out = diffCommands(['ping', 'aide', 'ping'], []);
    expect(out.available).toEqual(['aide', 'ping']);
  });

  it('traite known omis comme une premiere synchro', () => {
    const out = diffCommands(['ping']);
    expect(out.added).toEqual(['ping']);
  });
});
