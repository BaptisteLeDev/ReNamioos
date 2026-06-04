/**
 * Port TypeScript du harnais de CARACTERISATION (tests/test_characterization.py).
 *
 * OBJET : pinner le comportement ACTUEL du domaine de stylisation, en parite
 * STRICTE avec le bot.py legacy. Ces tests decrivent ce qui EST, pas ce qui
 * DEVRAIT etre. Aucun bug n'est corrige : les comportements surprenants
 * (non-idempotence destructrice, accents perdus en bord, chiffres 2/6/9 non
 * mappes, scriptify fantome, troncature) sont PINNES tels quels.
 *
 * Les litteraux Unicode sont COPIES depuis le harnais Python (escapes \U0001d4xx
 * -> \u{1d4xx} en TS), jamais recalcules a la main. Voir docs/caracterisation.md.
 */
import { describe, expect, it } from 'bun:test';
import {
  CONVERSIONS,
  ROLE_CONFIG,
  STYLE_NAMES,
  STYLES,
  type StyleName,
} from './styles';
import {
  convertirChiffres,
  convertirTexte,
  mettreMajusculeDebut,
  nettoyerPseudo,
  type ResultatStylisation,
  tronquerPseudo,
} from './stylisation';

/** Chaque style en ligne `it.each` (tuple a 1 element, table mutable). */
const STYLE_ROWS: Array<[StyleName]> = STYLE_NAMES.map((s) => [s]);

/**
 * Deballe le cas succes d'un ResultatStylisation (ECART VOLONTAIRE B4 :
 * convertirTexte renvoie un Result, ADR-0003 decision 3). Echoue explicitement
 * si le domaine a renvoye une erreur metier.
 */
function attenduOk(r: ResultatStylisation): string {
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(`attendu ok:true, recu erreur '${r.erreur}'`);
  return r.texte;
}

// ===================================================================
// 1. DONNEES CHARGEES (styles.json / role.json) — provenance pinnee
// ===================================================================

describe('donnees chargees', () => {
  it('test_neuf_styles_charges', () => {
    // PINNE : styles.json definit 9 styles alors que /aide et la doc annoncent 8.
    expect(Object.keys(STYLES)).toEqual([...STYLE_NAMES]);
    expect(Object.keys(STYLES).length).toBe(9);
  });

  it('test_conversions_chiffres_mapping_exact', () => {
    // ÉCART VOLONTAIRE (B4): mapping COMPLETE aux 10 chiffres (ADR-0003, decision 4).
    // 2->Z, 6->G, 9->G ajoutes ; collision 6=9=G assumee et documentee.
    expect(CONVERSIONS).toEqual({
      '0': 'O',
      '1': 'I',
      '2': 'Z',
      '3': 'E',
      '4': 'A',
      '5': 'S',
      '6': 'G',
      '7': 'T',
      '8': 'B',
      '9': 'G',
    });
    for (const chiffre of '0123456789') {
      expect(chiffre in CONVERSIONS).toBe(true);
    }
  });

  it('test_role_config_pinne', () => {
    // PINNE : un seul style cable a des roles (scriptify), 9 roles.
    expect(Object.keys(ROLE_CONFIG)).toEqual(['scriptify']);
    expect(ROLE_CONFIG['scriptify']?.length).toBe(9);
  });

  it.each(STYLE_ROWS)('test_chaque_style_couvre_les_52_lettres_ascii [%s]', (style) => {
    const styleMap = STYLES[style];
    for (const c of 'abcdefghijklmnopqrstuvwxyz') {
      expect(c in styleMap).toBe(true);
    }
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(c in styleMap).toBe(true);
    }
  });

  it.each(STYLE_ROWS)('test_aucun_style_ne_mappe_les_chiffres [%s]', (style) => {
    // PINNE (invariant conserve) : aucun style ne contient de glyphe pour 0-9.
    // Depuis B4 (ADR-0003 decision 4) les 10 chiffres sont mappes vers des
    // LETTRES par convertirChiffres AVANT le style, donc plus aucun chiffre nu
    // n'atteint la table de style.
    const styleMap = STYLES[style];
    for (const d of '0123456789') {
      expect(d in styleMap).toBe(false);
    }
  });

  it('test_carres_et_cercles_sont_insensibles_a_la_casse', () => {
    // PINNE : pour cercles et carres, minuscule et majuscule pointent vers le
    // MEME glyphe (Unicode enclosed sans variante de casse).
    for (const style of ['cercles', 'carres'] as const) {
      const m = STYLES[style];
      expect(m['a']).toBe(m['A']);
      expect(m['z']).toBe(m['Z']);
    }
  });
});

// ===================================================================
// 2. nettoyerPseudo — retrait des caracteres speciaux aux extremites
// ===================================================================

describe('nettoyerPseudo', () => {
  it.each([
    ['...hi!!', 'hi'],
    ['!!!###', ''], // que des speciaux -> vide
    ['hello', 'hello'], // rien a nettoyer
    ['  spaced  ', 'spaced'],
    ['---a---', 'a'],
    ['a.b.c', 'a.b.c'], // PINNE : points INTERNES conserves
    ['123abc456', '123abc456'], // chiffres = alphanumeriques, conserves
  ])('test_nettoyer_pseudo_extremites [%s]', (entree, attendu) => {
    expect(nettoyerPseudo(entree)).toBe(attendu);
  });

  it('test_nettoyer_pseudo_conserve_accents_en_bord', () => {
    // ÉCART VOLONTAIRE (B4): accents PRESERVES partout (ADR-0003, decision 2).
    // Le nettoyage ne rogne plus que les non-lettres-non-chiffres en bord ; une
    // lettre Unicode (accentuee comprise) est conservee quelle que soit sa
    // position. Avant B4 : 'éhello'->'hello', 'café'->'caf'.
    expect(nettoyerPseudo('éhello')).toBe('éhello');
    expect(nettoyerPseudo('café')).toBe('café');
  });

  it('test_nettoyer_pseudo_conserve_accents_internes', () => {
    // Un accent interne est conserve (deja le cas avant B4 ; desormais coherent
    // avec les accents en bord).
    expect(nettoyerPseudo('naïve')).toBe('naïve'); // 'naïve' inchange
  });

  it('test_nettoyer_pseudo_rogne_les_symboles_en_bord_garde_les_lettres', () => {
    // ÉCART VOLONTAIRE (B4): seuls les non-lettres-non-chiffres sont rognes en
    // bord ; les lettres accentuees survivent au milieu des symboles rognes.
    expect(nettoyerPseudo('***café***')).toBe('café');
    expect(nettoyerPseudo('  élan  ')).toBe('élan');
  });

  it('test_nettoyer_pseudo_vide', () => {
    expect(nettoyerPseudo('')).toBe('');
  });
});

// ===================================================================
// 3. convertirChiffres — chiffres -> lettres MAJUSCULES
// ===================================================================

describe('convertirChiffres', () => {
  it('test_convertir_chiffres_mappes', () => {
    // PINNE : 0,1,3,4,5,7,8 -> lettres MAJUSCULES.
    expect(convertirChiffres('0134578')).toBe('OIEASTB');
  });

  it('test_convertir_chiffres_tous_mappes', () => {
    // ÉCART VOLONTAIRE (B4): les 10 chiffres sont mappes (ADR-0003, decision 4).
    // Avant B4 : '0123456789' -> 'OI2EAS6TB9' (2/6/9 nus). Desormais 2->Z, 6->G,
    // 9->G : plus aucun chiffre nu.
    expect(convertirChiffres('0123456789')).toBe('OIZEASGTBG');
  });

  it('test_convertir_chiffres_sans_chiffre', () => {
    expect(convertirChiffres('hello')).toBe('hello');
  });

  it('test_convertir_chiffres_vide', () => {
    expect(convertirChiffres('')).toBe('');
  });
});

// ===================================================================
// 4. mettreMajusculeDebut — majuscule sur la 1re LETTRE
// ===================================================================

describe('mettreMajusculeDebut', () => {
  it.each([
    ['hello', 'Hello'],
    ['12ab', '12Ab'], // PINNE : majuscule sur la 1re LETTRE, pas le 1er char
    ['HELLO', 'HELLO'],
    ['123', '123'], // aucune lettre -> inchange
    ['', ''],
  ])('test_mettre_majuscule_debut [%s]', (entree, attendu) => {
    expect(mettreMajusculeDebut(entree)).toBe(attendu);
  });

  it('test_mettre_majuscule_debut_lettre_deja_stylisee', () => {
    // PINNE : un glyphe Unicode stylise (ex '𝓱') est une lettre (\p{L}) mais
    // .toUpperCase() le laisse identique (pas de forme majuscule) -> inchange.
    const dejaStylise = '\u{1d4f1}ello'; // '𝓱ello'
    expect(mettreMajusculeDebut(dejaStylise)).toBe(dejaStylise);
  });
});

// ===================================================================
// 5. convertirTexte — pipeline complet (nettoyer -> chiffres -> maj -> style)
// ===================================================================

describe('convertirTexte', () => {
  it('test_convertir_texte_alphabet_complet_cursive', () => {
    // Le pipeline met une majuscule sur la 1re lettre : 'a' devient 'A' avant style.
    expect(attenduOk(convertirTexte('abc', 'cursive'))).toBe('\u{1d4d0}\u{1d4eb}\u{1d4ec}'); // 𝓐𝓫𝓬
  });

  it('test_convertir_texte_scriptify_present', () => {
    // scriptify est un style public de plein droit (ADR-0003, decision 1).
    expect(attenduOk(convertirTexte('abc', 'scriptify'))).toBe('\u{1d49c}\u{1d4b7}\u{1d4b8}'); // 𝒜𝒷𝒸
  });

  it.each(STYLE_ROWS)('test_convertir_texte_tous_styles_un_mot [%s]', (style) => {
    // Smoke : chaque style produit une sortie non vide et != entree pour un mot ASCII.
    const out = attenduOk(convertirTexte('renamio', style));
    expect(out).toBeTruthy();
    expect(out).not.toBe('renamio');
  });

  it('test_convertir_texte_chiffres_mappes_deviennent_lettres_stylisees', () => {
    // ÉCART VOLONTAIRE (B4): '2' est desormais mappe (2->Z) (ADR-0003, decision 4).
    // '12abc' -> '1'->'I', '2'->'Z', majuscule sur la 1re lettre (le 'I', deja
    // majuscule), style applique a tout. Avant B4 : le '2' restait nu.
    expect(attenduOk(convertirTexte('12abc', 'cursive'))).toBe(
      '\u{1d4d8}\u{1d4e9}\u{1d4ea}\u{1d4eb}\u{1d4ec}', // 𝓘𝓩𝓪𝓫𝓬 (I Z a b c stylises)
    );
  });

  it('test_convertir_texte_accent_en_bord_preserve', () => {
    // ÉCART VOLONTAIRE (B4): accents PRESERVES partout (ADR-0003, decision 2).
    // 'café' -> nettoyer garde le 'é' final -> 'café' -> style (le 'é' traverse
    // non stylise). Avant B4 : 'café' -> 'caf' -> 𝓒𝓪𝓯.
    expect(attenduOk(convertirTexte('café', 'cursive'))).toBe(
      '\u{1d4d2}\u{1d4ea}\u{1d4ef}' + 'é', // 𝓒𝓪𝓯é
    );
  });

  it('test_convertir_texte_accent_initial_capitalise_et_preserve', () => {
    // ÉCART VOLONTAIRE (B4): un accent en tete survit au nettoyage et devient la
    // 1re lettre capitalisee ('é'->'É'), non stylisee (pas de glyphe). Avant B4 :
    // 'éhello' -> 'hello' -> 𝓗𝓮𝓵𝓵𝓸.
    expect(attenduOk(convertirTexte('éhello', 'cursive'))).toBe(
      'É' + '\u{1d4f1}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}', // É𝓱𝓮𝓵𝓵𝓸
    );
  });

  it('test_convertir_texte_accent_interne_traverse_le_style_inchange', () => {
    // Un accent interne survit a nettoyer mais n'a pas de glyphe de style -> il
    // traverse tel quel (styleMap[char] ?? char). Inchange par B4.
    expect(attenduOk(convertirTexte('aéb', 'cursive'))).toBe('\u{1d4d0}' + 'é' + '\u{1d4eb}'); // 𝓐é𝓫
  });

  it('test_convertir_texte_espace_interne_conserve', () => {
    // Un espace interne n'est ni en bord (pas supprime par nettoyer) ni dans le
    // style map -> conserve tel quel.
    expect(attenduOk(convertirTexte('a b', 'cursive'))).toBe('\u{1d4d0}' + ' ' + '\u{1d4eb}'); // '𝓐 𝓫'
  });

  it('test_convertir_texte_style_inconnu_erreur_metier', () => {
    // ÉCART VOLONTAIRE (B4): style inconnu -> erreur metier 'style-inconnu'
    // (ADR-0003, decision 3), plus de renvoi de l'entree brute.
    const r = convertirTexte('hello', 'inexistant' as StyleName);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toBe('style-inconnu');
  });

  it('test_convertir_texte_vide_erreur_metier', () => {
    // ÉCART VOLONTAIRE (B4): entree vide -> rien a styliser -> erreur metier
    // 'rien-a-styliser' (ADR-0003, decision 3). Avant B4 : ''.
    const r = convertirTexte('', 'cursive');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toBe('rien-a-styliser');
  });

  it('test_convertir_texte_que_des_caracteres_speciaux_erreur_metier', () => {
    // ÉCART VOLONTAIRE (B4): nettoyer rogne tout -> aucune lettre ASCII -> erreur
    // metier au lieu d'un string vide silencieux (ADR-0003, decision 3). Avant B4 : ''.
    const r = convertirTexte('!!!###', 'cursive');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toBe('rien-a-styliser');
  });

  it('test_convertir_texte_deja_stylise_refus_propre', () => {
    // ÉCART VOLONTAIRE (B4): re-styliser un texte deja stylise -> REFUS PROPRE
    // (ADR-0003, decision 3). Les glyphes stylises sont des lettres Unicode mais
    // PAS des lettres ASCII [A-Za-z] (la seule matiere du style) : il n'y a donc
    // RIEN a styliser -> erreur metier 'rien-a-styliser', AUCUN rendu. Plus de
    // destruction silencieuse, pas de de-stylisation magique. Avant B4 : ''.
    const uneFois = convertirTexte('hello', 'cursive');
    expect(attenduOk(uneFois)).toBe('\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}'); // 𝓗𝓮𝓵𝓵𝓸
    const deuxFois = convertirTexte(attenduOk(uneFois), 'cursive');
    expect(deuxFois.ok).toBe(false);
    if (!deuxFois.ok) expect(deuxFois.erreur).toBe('rien-a-styliser');
  });
});

// ===================================================================
// 6. Troncature 32 caracteres (limite Discord)
// ===================================================================
//
// NOTE : la troncature `if len(x) > 32: x = x[:32]` vit DANS les handlers
// Discord (on_member_update, rename_slash, random_slash), PAS dans convertirTexte.
// On pinne ICI la regle telle qu'appliquee par le bot, reproduite a l'identique
// sur la sortie de convertirTexte. ATTENTION JS : decoupage par CODE POINT
// ([...str].slice(0,32)) et non str.slice(0,32) (qui couperait une paire de
// substitution UTF-16 sur les glyphes hors BMP).

describe('troncature', () => {
  it('test_troncature_compte_les_code_points_pas_les_octets', () => {
    // PINNE : len() Python compte les CODE POINTS Unicode. Un glyphe stylise
    // hors BMP (ex cursive, 1 code point >0xFFFF) compte pour 1. La troncature
    // a 32 garde donc 32 code points.
    const source = 'a'.repeat(40); // 40 lettres -> 40 glyphes
    const styleOut = attenduOk(convertirTexte(source, 'cursive'));
    // 1re lettre en majuscule (A) ; le reste en minuscule. 40 glyphes au total.
    expect([...styleOut].length).toBe(40);
    const tronque = tronquerPseudo(styleOut);
    expect([...tronque].length).toBe(32);
  });

  it('test_troncature_ne_touche_pas_les_pseudos_courts', () => {
    const out = attenduOk(convertirTexte('renamio', 'cursive'));
    expect([...out].length).toBeLessThanOrEqual(32);
    expect(tronquerPseudo(out)).toBe(out);
  });
});
