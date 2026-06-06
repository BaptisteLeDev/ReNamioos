/**
 * Test d'acceptation du FileMappingStore (B8, ADR-0005).
 *
 * Adapter FICHIER du port MappingStore : enrobe l'ancien `auto-rename.json`
 * (ADR-0004) pour le mode DEV (sans DATABASE_URL). Le fichier est GLOBAL (pas de
 * notion de guild) : `list`/`styleForRole` renvoient le meme mapping quelle que
 * soit la guild. L'ECRITURE n'est PAS supportee en mode fichier (le fichier dev
 * s'edite a la main) : `add`/`remove` levent une erreur explicite -> en prod, la
 * config par serveur passe forcement par Neon.
 *
 * On INJECTE le mapping deja charge (le chargeur+validation zod reste
 * src/config/auto-rename-config.ts) : ce store ne refait pas d'I/O fichier.
 */
import { describe, expect, it } from 'bun:test';
import type { MappingRoleStyle } from '../domain/auto-rename';
import { creerFileMappingStore } from './file-store';

const MAPPING: MappingRoleStyle = { r1: 'cursive', r2: 'gothique' };

describe('FileMappingStore', () => {
  it('list renvoie le mapping fichier (global, ignore la guild)', async () => {
    const store = creerFileMappingStore(MAPPING);
    expect(await store.list('guild-a')).toEqual({ r1: 'cursive', r2: 'gothique' });
    expect(await store.list('guild-b')).toEqual({ r1: 'cursive', r2: 'gothique' });
  });

  it("list preserve l'ordre des cles (priorite ADR-0004)", async () => {
    const store = creerFileMappingStore({ b: 'gras', a: 'cursive' });
    expect(Object.keys(await store.list('g'))).toEqual(['b', 'a']);
  });

  it('styleForRole renvoie le style mappe, sinon null', async () => {
    const store = creerFileMappingStore(MAPPING);
    expect(await store.styleForRole('g', 'r1')).toBe('cursive');
    expect(await store.styleForRole('g', 'absent')).toBeNull();
  });

  it('add rejette : ecriture non supportee en mode fichier (dev)', async () => {
    const store = creerFileMappingStore(MAPPING);
    await expect(store.add('g', 'r3', 'gras')).rejects.toThrow(/fichier|Neon|DATABASE_URL/i);
  });

  it('remove rejette : ecriture non supportee en mode fichier (dev)', async () => {
    const store = creerFileMappingStore(MAPPING);
    await expect(store.remove('g', 'r1')).rejects.toThrow(/fichier|Neon|DATABASE_URL/i);
  });

  it("list renvoie une COPIE (mutation externe n'affecte pas le store)", async () => {
    const store = creerFileMappingStore(MAPPING);
    const copie = await store.list('g');
    copie['r1'] = 'gras';
    expect(await store.styleForRole('g', 'r1')).toBe('cursive');
  });
});
