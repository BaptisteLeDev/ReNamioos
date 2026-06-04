/**
 * Test d'acceptation du chargeur de config auto-rename (B6, ADR-0004).
 *
 * Frontiere (I/O + validation) : lit un fichier JSON `roleId -> styleName`, le
 * valide avec zod contre la table autoritaire des styles, et echoue FORT au boot
 * si un style est inconnu / si le fichier manque / si le JSON est malforme.
 * Aucun catch silencieux : la config invalide doit empecher le demarrage.
 *
 * Le domaine consomme le mapping deja valide ; ce module est le seul a connaitre
 * le chemin du fichier (provenance centralisee, mandat ARCHITECTURE.md).
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chargerConfigAutoRename } from './auto-rename-config';

const tempDirs: string[] = [];

function ecrireConfig(contenu: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'renamioos-autorename-'));
  tempDirs.push(dir);
  const chemin = join(dir, 'auto-rename.json');
  writeFileSync(chemin, contenu, 'utf8');
  return chemin;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('chargerConfigAutoRename', () => {
  it('charge un mapping valide roleId -> styleName', () => {
    const chemin = ecrireConfig(JSON.stringify({ '111': 'cursive', '222': 'scriptify' }));
    const mapping = chargerConfigAutoRename(chemin);
    expect(mapping).toEqual({ '111': 'cursive', '222': 'scriptify' });
  });

  it('PRESERVE l ordre des cles (= priorite du fichier, ADR-0004)', () => {
    const chemin = ecrireConfig(JSON.stringify({ b: 'gothique', a: 'cursive', c: 'scriptify' }));
    const mapping = chargerConfigAutoRename(chemin);
    expect(Object.keys(mapping)).toEqual(['b', 'a', 'c']);
  });

  it('style INCONNU -> erreur de boot explicite (nomme le role et le style)', () => {
    const chemin = ecrireConfig(JSON.stringify({ '111': 'cursive', '999': 'inexistant' }));
    expect(() => chargerConfigAutoRename(chemin)).toThrow(/999|inexistant/i);
  });

  it('fichier absent -> erreur de boot explicite (nomme le chemin)', () => {
    expect(() => chargerConfigAutoRename('C:/chemin/qui/n/existe/pas-12345.json')).toThrow(
      /pas-12345\.json|introuvable|config/i,
    );
  });

  it('JSON malforme -> erreur de boot explicite', () => {
    const chemin = ecrireConfig('{ ceci n est pas du json');
    expect(() => chargerConfigAutoRename(chemin)).toThrow();
  });

  it('mapping vide -> mapping vide (auto-rename desactive, pas une erreur)', () => {
    const chemin = ecrireConfig(JSON.stringify({}));
    expect(chargerConfigAutoRename(chemin)).toEqual({});
  });

  it('valeur non-string (ex: nombre) -> erreur de validation', () => {
    const chemin = ecrireConfig(JSON.stringify({ '111': 42 }));
    expect(() => chargerConfigAutoRename(chemin)).toThrow();
  });
});
