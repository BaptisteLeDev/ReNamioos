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
  tronquerPseudo,
} from './stylisation';

/** Chaque style en ligne `it.each` (tuple a 1 element, table mutable). */
const STYLE_ROWS: Array<[StyleName]> = STYLE_NAMES.map((s) => [s]);

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
    // PINNE : seuls 7 chiffres sont mappes ; 2, 6 et 9 sont absents.
    expect(CONVERSIONS).toEqual({
      '0': 'O',
      '1': 'I',
      '3': 'E',
      '4': 'A',
      '5': 'S',
      '7': 'T',
      '8': 'B',
    });
    for (const absent of ['2', '6', '9']) {
      expect(absent in CONVERSIONS).toBe(false);
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
    // PINNE : aucun style ne contient de glyphe pour 0-9. Les chiffres non
    // convertis en lettres (2/6/9) traversent donc tels quels.
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

  it('test_nettoyer_pseudo_supprime_accents_en_bord', () => {
    // PINNE : [^a-zA-Z0-9] considere les lettres accentuees comme speciales.
    // Un accent en DEBUT ou FIN de pseudo est donc SUPPRIME.
    expect(nettoyerPseudo('éhello')).toBe('hello'); // 'éhello' -> 'hello'
    expect(nettoyerPseudo('café')).toBe('caf'); // 'café' -> 'caf' (é final supprime)
  });

  it('test_nettoyer_pseudo_conserve_accents_internes', () => {
    // PINNE : un accent ENTOURE d'ASCII (non en bord) est conserve.
    expect(nettoyerPseudo('naïve')).toBe('naïve'); // 'naïve' inchange
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

  it('test_convertir_chiffres_non_mappes_inchanges', () => {
    // PINNE : 2, 6 et 9 n'ont pas de mapping -> conserves.
    expect(convertirChiffres('0123456789')).toBe('OI2EAS6TB9');
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
    expect(convertirTexte('abc', 'cursive')).toBe('\u{1d4d0}\u{1d4eb}\u{1d4ec}'); // 𝓐𝓫𝓬
  });

  it('test_convertir_texte_scriptify_present', () => {
    // scriptify est bien fonctionnel meme s'il est absent de l'UI /aide.
    expect(convertirTexte('abc', 'scriptify')).toBe('\u{1d49c}\u{1d4b7}\u{1d4b8}'); // 𝒜𝒷𝒸
  });

  it.each(STYLE_ROWS)('test_convertir_texte_tous_styles_un_mot [%s]', (style) => {
    // Smoke : chaque style produit une sortie non vide et != entree pour un mot ASCII.
    const out = convertirTexte('renamio', style);
    expect(out).toBeTruthy();
    expect(out).not.toBe('renamio');
  });

  it('test_convertir_texte_chiffres_mappes_deviennent_lettres_stylisees', () => {
    // PINNE : '12abc' -> '1'->'I', '2' non mappe, puis majuscule sur la 1re
    // lettre (le 'I' issu de '1', deja majuscule), style applique. '2' n'a ni
    // conversion ni glyphe de style -> reste un '2' nu.
    expect(convertirTexte('12abc', 'cursive')).toBe(
      '\u{1d4d8}' + '2' + '\u{1d4ea}\u{1d4eb}\u{1d4ec}', // 𝓘2𝓪𝓫𝓬
    );
  });

  it('test_convertir_texte_accent_en_bord_supprime', () => {
    // PINNE : 'café' -> nettoyer retire le 'é' final -> 'caf' -> style.
    expect(convertirTexte('café', 'cursive')).toBe('\u{1d4d2}\u{1d4ea}\u{1d4ef}'); // 𝓒𝓪𝓯
  });

  it('test_convertir_texte_accent_interne_traverse_le_style_inchange', () => {
    // PINNE : un accent interne survit a nettoyer mais n'a pas de glyphe de
    // style -> il traverse tel quel (style_map.get(char, char)).
    expect(convertirTexte('aéb', 'cursive')).toBe('\u{1d4d0}' + 'é' + '\u{1d4eb}'); // 𝓐é𝓫
  });

  it('test_convertir_texte_espace_interne_conserve', () => {
    // PINNE : un espace interne n'est ni en bord (pas supprime par nettoyer)
    // ni dans le style map -> conserve tel quel.
    expect(convertirTexte('a b', 'cursive')).toBe('\u{1d4d0}' + ' ' + '\u{1d4eb}'); // '𝓐 𝓫'
  });

  it('test_convertir_texte_style_inconnu_renvoie_entree_brute', () => {
    // PINNE : style inconnu -> texte renvoye SANS aucun traitement (ni nettoyage,
    // ni chiffres, ni majuscule). Court-circuit en tete de fonction.
    expect(convertirTexte('hello', 'inexistant' as StyleName)).toBe('hello');
    expect(convertirTexte('...HELLO!!!', 'inexistant' as StyleName)).toBe('...HELLO!!!');
  });

  it('test_convertir_texte_vide', () => {
    expect(convertirTexte('', 'cursive')).toBe('');
  });

  it('test_convertir_texte_que_des_caracteres_speciaux_donne_vide', () => {
    // PINNE : nettoyer supprime tout -> chaine vide en sortie.
    expect(convertirTexte('!!!###', 'cursive')).toBe('');
  });

  it('test_convertir_texte_n_est_PAS_idempotent', () => {
    // PINNE (surprenant mais reel) : appliquer un style DEUX fois DETRUIT la
    // chaine. Les glyphes stylises sont non-[a-zA-Z0-9] : au 2e passage
    // nettoyerPseudo les considere tous comme speciaux et les retire (bords),
    // et comme TOUTE la chaine est stylisee, il ne reste RIEN.
    const uneFois = convertirTexte('hello', 'cursive');
    const deuxFois = convertirTexte(uneFois, 'cursive');
    expect(uneFois).toBe('\u{1d4d7}\u{1d4ee}\u{1d4f5}\u{1d4f5}\u{1d4f8}'); // 𝓗𝓮𝓵𝓵𝓸
    expect(deuxFois).toBe(''); // destruction totale
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
    const styleOut = convertirTexte(source, 'cursive');
    // 1re lettre en majuscule (A) ; le reste en minuscule. 40 glyphes au total.
    expect([...styleOut].length).toBe(40);
    const tronque = tronquerPseudo(styleOut);
    expect([...tronque].length).toBe(32);
  });

  it('test_troncature_ne_touche_pas_les_pseudos_courts', () => {
    const out = convertirTexte('renamio', 'cursive');
    expect([...out].length).toBeLessThanOrEqual(32);
    expect(tronquerPseudo(out)).toBe(out);
  });
});
