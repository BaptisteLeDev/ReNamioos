/**
 * Pipeline de stylisation de pseudo — coeur metier PUR de ReNamioos.
 *
 * Port a PARITE STRICTE des fonctions de `bot.py` legacy (nettoyer_pseudo,
 * convertir_chiffres, mettre_majuscule_debut, convertir_texte). Le comportement
 * pinne par le harnais de caracterisation est REPRODUIT tel quel, bugs compris
 * (non-idempotence destructrice, accents perdus en bord, chiffres 2/6/9 non
 * convertis). Les corrections eventuelles sont des decisions B4/B5, pas des
 * effets de bord (cf. docs/caracterisation.md, § Bugs pinnes).
 *
 * Aucune dependance externe : ni Discord.js, ni Fastify, ni I/O. Les seules
 * donnees viennent de `./styles` (provenance centralisee).
 */
import { CONVERSIONS, STYLES, type StyleName } from './styles';

/** Vrai si le caractere est une lettre Unicode (equivalent Python str.isalpha()). */
const LETTRE = /\p{L}/u;

/**
 * Retire les caracteres non `[a-zA-Z0-9]` (ASCII) aux EXTREMITES seulement.
 * Port de bot.py:69. PINNE : les lettres accentuees ne sont pas ASCII, donc un
 * accent en bord est supprime ; un accent interne survit.
 */
export function nettoyerPseudo(texte: string): string {
  return texte.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '');
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
 * Pipeline complet : court-circuit style inconnu -> nettoyer -> chiffres ->
 * capitaliser -> mapper le style (char par char, glyphe ou caractere brut).
 * Port de bot.py:93.
 */
export function convertirTexte(texte: string, style: StyleName): string {
  const styleMap = STYLES[style];
  // [0] PINNE : style inconnu -> entree brute, AUCUN traitement.
  if (styleMap === undefined) return texte;

  // [1] nettoyer  [2] chiffres  [3] capitaliser
  const prepare = mettreMajusculeDebut(convertirChiffres(nettoyerPseudo(texte)));

  // [4] mappage style, char par char (get(char, char)).
  let resultat = '';
  for (const char of prepare) {
    resultat += styleMap[char] ?? char;
  }
  return resultat;
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
