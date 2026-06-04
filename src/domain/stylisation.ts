/**
 * Pipeline de stylisation de pseudo — coeur metier PUR de ReNamioos.
 *
 * Successeur du port B3 (parite stricte avec `bot.py`), corrige par le lot B4
 * (cf. decisions/0003-corrections-comportements-pinnes.md). Quatre ECARTS
 * VOLONTAIRES vis-a-vis du comportement pinne legacy :
 *   1. scriptify est un style public (cote UI/doc, pas ici).
 *   2. accents PRESERVES partout (le nettoyage ne rogne plus les lettres en bord).
 *   3. re-styliser un texte deja stylise -> REFUS PROPRE (erreur metier, type
 *      Result : un texte vide apres nettoyage cesse d'etre un etat valide).
 *   4. mapping chiffres complete (2/6/9 mappes ; cote `data/styles.json`).
 *
 * Aucune dependance externe : ni Discord.js, ni Fastify, ni I/O. Les seules
 * donnees viennent de `./styles` (provenance centralisee).
 */
import { CONVERSIONS, STYLES, type StyleName } from './styles';

/** Vrai si le caractere est une lettre Unicode (equivalent Python str.isalpha()). */
const LETTRE = /\p{L}/u;

/**
 * Erreurs metier de la stylisation (union fermee). Rendent l'echec explicite :
 * - `style-inconnu` : le style demande n'existe pas dans la table autoritaire.
 * - `rien-a-styliser` : aucun caractere stylisable dans l'entree. Couvre l'entree
 *   vide, les entrees ne contenant que des symboles, ET le texte DEJA stylise
 *   (glyphes Unicode hors `[A-Za-z]` -> aucune lettre ASCII a transformer).
 *   Refus propre, pas de de-stylisation magique (ADR-0003, decision 3).
 */
export type ErreurStylisation = 'style-inconnu' | 'rien-a-styliser';

/** Vrai s'il existe au moins une lettre ASCII `[A-Za-z]` (seule matiere stylisable). */
const LETTRE_ASCII = /[a-zA-Z]/;

/**
 * Resultat discrimine du pipeline (ADR-0003, decision 3). Rend les etats
 * invalides irrepresentables : le "texte vide en sortie" n'est plus un string
 * silencieux mais un cas `ok: false` que l'appelant DOIT traiter.
 */
export type ResultatStylisation =
  | { ok: true; texte: string }
  | { ok: false; erreur: ErreurStylisation };

/**
 * Retire les caracteres non-LETTRE-non-CHIFFRE aux EXTREMITES seulement.
 * ECART VOLONTAIRE B4 (ADR-0003, decision 2) : on conserve toute lettre Unicode
 * (`\p{L}`, accents compris) et tout chiffre `0-9` quelle que soit sa position.
 * Seuls la ponctuation, les symboles et les espaces sont rognes en bord. Les
 * espaces/points INTERNES restent conserves (non en bord).
 */
export function nettoyerPseudo(texte: string): string {
  return texte.replace(/^[^\p{L}0-9]+/u, '').replace(/[^\p{L}0-9]+$/u, '');
}

/**
 * Substitue chaque chiffre mappe par sa lettre MAJUSCULE, dans tout le texte.
 * Port de bot.py:77. PINNE : 2/6/9 absents du mapping -> conserves tels quels.
 * L'ordre des substitutions est sans effet : aucune lettre de sortie n'est une
 * cle (chiffre), donc pas de cascade.
 */
export function convertirChiffres(texte: string): string {
  let resultat = texte;
  for (const [chiffre, lettre] of Object.entries(CONVERSIONS)) {
    resultat = resultat.replaceAll(chiffre, lettre);
  }
  return resultat;
}

/**
 * Met en majuscule la PREMIERE LETTRE rencontree (pas le premier caractere).
 * Port de bot.py:83. PINNE : un glyphe deja stylise est une lettre mais son
 * .toUpperCase() le laisse identique -> chaine inchangee.
 */
export function mettreMajusculeDebut(texte: string): string {
  if (!texte) return texte;
  const chars = [...texte];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c !== undefined && LETTRE.test(c)) {
      chars[i] = c.toUpperCase();
      return chars.join('');
    }
  }
  return texte;
}

/**
 * Pipeline complet : style inconnu -> erreur ; nettoyer -> chiffres ->
 * capitaliser ; si vide -> refus propre ; sinon mapper le style (char par char,
 * glyphe ou caractere brut).
 *
 * ECART VOLONTAIRE B4 (ADR-0003, decision 3) : renvoie un ResultatStylisation,
 * plus un string. Un style inconnu ou un texte sans matiere stylisable
 * (typiquement un texte DEJA stylise, dont les glyphes ne sont pas des lettres
 * ASCII) deviennent des erreurs metier explicites, jamais un string vide ni une
 * destruction silencieuse. Aucune de-stylisation magique.
 */
export function convertirTexte(texte: string, style: StyleName): ResultatStylisation {
  const styleMap = STYLES[style];
  // [0] style inconnu -> erreur metier (avant B4 : renvoyait l'entree brute).
  if (styleMap === undefined) return { ok: false, erreur: 'style-inconnu' };

  // [1] nettoyer  [2] chiffres (chiffres -> lettres ASCII)
  const converti = convertirChiffres(nettoyerPseudo(texte));

  // Refus propre : rien a styliser. Seules les lettres ASCII [A-Za-z] sont la
  // matiere du style (les chiffres ont deja ete convertis en lettres ASCII).
  // Absence de lettre ASCII = entree vide, que des symboles, ou DEJA stylisee.
  if (!LETTRE_ASCII.test(converti)) return { ok: false, erreur: 'rien-a-styliser' };

  // [3] capitaliser  [4] mappage style, char par char (styleMap[char] ?? char).
  const prepare = mettreMajusculeDebut(converti);
  let resultat = '';
  for (const char of prepare) {
    resultat += styleMap[char] ?? char;
  }
  return { ok: true, texte: resultat };
}

/**
 * Troncature a 32 par CODE POINT (limite Discord), telle qu'appliquee par les
 * handlers legacy (bot.py:157-158/318-319/373-374). ATTENTION JS : on decoupe
 * par code point ([...str]) et non str.slice qui couperait une paire de
 * substitution UTF-16 sur les glyphes hors BMP.
 */
export function tronquerPseudo(pseudo: string, limite = 32): string {
  const codePoints = [...pseudo];
  if (codePoints.length > limite) {
    return codePoints.slice(0, limite).join('');
  }
  return pseudo;
}
