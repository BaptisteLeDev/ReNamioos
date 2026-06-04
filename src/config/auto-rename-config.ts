/**
 * Chargeur de la config auto-rename (B6, cf. decisions/0004-auto-rename.md).
 *
 * Frontiere I/O + validation : seul module qui sait OU vit le mapping roleId ->
 * styleName (provenance centralisee, mandat ARCHITECTURE.md) et comment le
 * valider. Le domaine pur (src/domain/auto-rename.ts) recoit un MappingRoleStyle
 * deja valide ; il n'ouvre jamais le fichier lui-meme.
 *
 * Config FICHIER versionnee, aucune DB (ADR-0002, decision 3). Le chemin est
 * configurable (AUTO_RENAME_CONFIG_PATH, cf. src/config.ts) ; un exemple committe
 * vit a la racine du repo (`auto-rename.example.json`).
 *
 * Echec FORT au boot : fichier absent, JSON malforme, ou style inconnu levent une
 * erreur explicite. Aucun catch silencieux — une config invalide ne doit pas
 * laisser le bot demarrer avec un auto-rename partiellement casse.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { STYLE_NAMES, type StyleName } from '../domain/styles';
import type { MappingRoleStyle } from '../domain/auto-rename';

/**
 * Chaque valeur du mapping doit etre l'un des 9 styles charges. Un style inconnu
 * = erreur de validation (et donc de boot). zod conserve l'ordre des cles de
 * l'objet parse -> la priorite « ordre du fichier » (ADR-0004) est preservee.
 */
const schema = z.record(z.string(), z.enum(STYLE_NAMES as unknown as [StyleName, ...StyleName[]]));

/**
 * Lit, parse et valide le fichier de mapping roleId -> styleName.
 * @throws Error explicite si le fichier est introuvable, le JSON malforme, ou un
 *   style inconnu (le message nomme le chemin / le role fautif).
 */
export function chargerConfigAutoRename(chemin: string): MappingRoleStyle {
  let brut: string;
  try {
    brut = readFileSync(chemin, 'utf8');
  } catch (cause) {
    throw new Error(
      `Config auto-rename introuvable ou illisible : « ${chemin} ». ` +
        `Cree le fichier (cf. auto-rename.example.json) ou ajuste AUTO_RENAME_CONFIG_PATH.`,
      { cause },
    );
  }

  let parse: unknown;
  try {
    parse = JSON.parse(brut);
  } catch (cause) {
    throw new Error(`Config auto-rename « ${chemin} » : JSON malforme.`, { cause });
  }

  const valide = schema.safeParse(parse);
  if (!valide.success) {
    const details = valide.error.issues
      .map((i) => `  - role « ${i.path.join('.') || '(racine)'} » : ${i.message}`)
      .join('\n');
    throw new Error(
      `Config auto-rename « ${chemin} » invalide ` +
        `(styles autorises : ${STYLE_NAMES.join(', ')}) :\n${details}`,
    );
  }

  return valide.data;
}
