# -*- coding: utf-8 -*-
"""
Tests de CARACTERISATION de la logique pure de ReNamioos (bot.py).

OBJET : pinner le comportement ACTUEL des fonctions de conversion, en memoire,
sans Discord ni I/O reseau. Ces tests forment le HARNAIS de la future reecriture
Bun/TypeScript : ils decrivent ce qui EST, pas ce qui DEVRAIT etre.

REGLE : aucun bug n'est corrige ici. Les comportements surprenants (perte
d'idempotence, accents en bord de chaine supprimes, chiffres 2/6/9 non mappes,
9 styles alors que la doc en annonce 8...) sont PINNES tels quels et annotes
"COMPORTEMENT PINNE". Voir docs/caracterisation.md pour l'inventaire complet.

IMPORT : voir tests/conftest.py — bot.py est importe via importlib avec des
modules factices injectes dans sys.modules (keep_alive, discord, dotenv) pour
neutraliser les effets de bord de niveau module. bot.py n'est PAS modifie.
"""

import pytest

from conftest import load_bot_module

bot = load_bot_module()

STYLE_NAMES = [
    "cercles",
    "cursive",
    "gothique",
    "gras",
    "monospace",
    "carres",
    "double",
    "fullwidth",
    "scriptify",
]


# ===================================================================
# 1. DONNEES CHARGEES (styles.json / role.json) — provenance pinnee
# ===================================================================


def test_neuf_styles_charges():
    # COMPORTEMENT PINNE : styles.json definit 9 styles, alors que /aide et la
    # doc annoncent "8 styles" (scriptify n'apparait pas dans les exemples UI).
    assert list(bot.STYLES.keys()) == STYLE_NAMES
    assert len(bot.STYLES) == 9


def test_conversions_chiffres_mapping_exact():
    # COMPORTEMENT PINNE : seuls 7 chiffres sont mappes ; 2, 6 et 9 sont absents.
    assert bot.CONVERSIONS == {
        "0": "O",
        "1": "I",
        "3": "E",
        "4": "A",
        "5": "S",
        "7": "T",
        "8": "B",
    }
    for absent in ("2", "6", "9"):
        assert absent not in bot.CONVERSIONS


def test_role_config_pinne():
    # COMPORTEMENT PINNE : un seul style cable a des roles (scriptify), 9 roles.
    assert list(bot.ROLE_CONFIG.keys()) == ["scriptify"]
    assert len(bot.ROLE_CONFIG["scriptify"]) == 9


@pytest.mark.parametrize("style", STYLE_NAMES)
def test_chaque_style_couvre_les_52_lettres_ascii(style):
    # Chaque style mappe les 26 minuscules ET 26 majuscules ASCII.
    style_map = bot.STYLES[style]
    for c in "abcdefghijklmnopqrstuvwxyz":
        assert c in style_map
    for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        assert c in style_map


@pytest.mark.parametrize("style", STYLE_NAMES)
def test_aucun_style_ne_mappe_les_chiffres(style):
    # COMPORTEMENT PINNE : aucun style ne contient de glyphe pour 0-9.
    # Les chiffres NON convertis en lettres (2/6/9) traversent donc tels quels.
    style_map = bot.STYLES[style]
    for d in "0123456789":
        assert d not in style_map


def test_carres_et_cercles_sont_insensibles_a_la_casse():
    # COMPORTEMENT PINNE : pour cercles et carres, minuscule et majuscule
    # pointent vers le MEME glyphe (pas de variante de casse en Unicode enclosed).
    for style in ("cercles", "carres"):
        m = bot.STYLES[style]
        assert m["a"] == m["A"]
        assert m["z"] == m["Z"]


# ===================================================================
# 2. nettoyer_pseudo — retrait des caracteres speciaux aux extremites
# ===================================================================


@pytest.mark.parametrize(
    "entree,attendu",
    [
        ("...hi!!", "hi"),
        ("!!!###", ""),          # que des speciaux -> vide
        ("hello", "hello"),       # rien a nettoyer
        ("  spaced  ", "spaced"),
        ("---a---", "a"),
        ("a.b.c", "a.b.c"),       # PINNE : points INTERNES conserves
        ("123abc456", "123abc456"),  # chiffres = alphanumeriques, conserves
    ],
)
def test_nettoyer_pseudo_extremites(entree, attendu):
    assert bot.nettoyer_pseudo(entree) == attendu


def test_nettoyer_pseudo_supprime_accents_en_bord():
    # COMPORTEMENT PINNE : la regex [^a-zA-Z0-9] considere les lettres accentuees
    # comme "speciales". Un accent en DEBUT ou FIN de pseudo est donc SUPPRIME.
    assert bot.nettoyer_pseudo("ehello".replace("e", "é", 1)) == "hello"  # 'éhello' -> 'hello'
    assert bot.nettoyer_pseudo("café") == "caf"  # 'café' -> 'caf' (é final supprime)


def test_nettoyer_pseudo_conserve_accents_internes():
    # COMPORTEMENT PINNE : un accent ENTOURE d'ASCII (non en bord) est conserve.
    assert bot.nettoyer_pseudo("naïve") == "naïve"  # 'naïve' inchange


def test_nettoyer_pseudo_vide():
    assert bot.nettoyer_pseudo("") == ""


# ===================================================================
# 3. convertir_chiffres — chiffres -> lettres MAJUSCULES
# ===================================================================


def test_convertir_chiffres_mappes():
    # COMPORTEMENT PINNE : 0,1,3,4,5,7,8 -> lettres MAJUSCULES.
    assert bot.convertir_chiffres("0134578") == "OIEASTB"


def test_convertir_chiffres_non_mappes_inchanges():
    # COMPORTEMENT PINNE : 2, 6 et 9 n'ont pas de mapping -> conserves.
    assert bot.convertir_chiffres("0123456789") == "OI2EAS6TB9"


def test_convertir_chiffres_sans_chiffre():
    assert bot.convertir_chiffres("hello") == "hello"


def test_convertir_chiffres_vide():
    assert bot.convertir_chiffres("") == ""


# ===================================================================
# 4. mettre_majuscule_debut — majuscule sur la 1re LETTRE
# ===================================================================


@pytest.mark.parametrize(
    "entree,attendu",
    [
        ("hello", "Hello"),
        ("12ab", "12Ab"),     # PINNE : majuscule sur la 1re LETTRE, pas le 1er char
        ("HELLO", "HELLO"),
        ("123", "123"),        # aucune lettre -> inchange
        ("", ""),
    ],
)
def test_mettre_majuscule_debut(entree, attendu):
    assert bot.mettre_majuscule_debut(entree) == attendu


def test_mettre_majuscule_debut_lettre_deja_stylisee():
    # COMPORTEMENT PINNE : un glyphe Unicode stylise (ex '𝓱') est .isalpha()==True
    # mais .upper() le laisse identique (pas de forme majuscule) -> chaine inchangee.
    deja_stylise = "\U0001d4f1ello"  # '𝓱ello'
    assert bot.mettre_majuscule_debut(deja_stylise) == deja_stylise


# ===================================================================
# 5. convertir_texte — pipeline complet (nettoyer -> chiffres -> maj -> style)
# ===================================================================


def test_convertir_texte_alphabet_complet_cursive():
    # Le pipeline met une majuscule sur la 1re lettre : 'a' devient 'A' avant style.
    assert bot.convertir_texte("abc", "cursive") == "\U0001d4d0\U0001d4eb\U0001d4ec"  # 𝓐𝓫𝓬


def test_convertir_texte_scriptify_present():
    # scriptify est bien fonctionnel meme s'il est absent de l'UI /aide.
    assert bot.convertir_texte("abc", "scriptify") == "\U0001d49c\U0001d4b7\U0001d4b8"  # 𝒜𝒷𝒸


@pytest.mark.parametrize("style", STYLE_NAMES)
def test_convertir_texte_tous_styles_un_mot(style):
    # Smoke : chaque style produit une sortie non vide et != entree pour un mot ASCII.
    out = bot.convertir_texte("renamio", style)
    assert out
    assert out != "renamio"


def test_convertir_texte_chiffres_mappes_deviennent_lettres_stylisees():
    # COMPORTEMENT PINNE : '12abc' -> '1'->'I', '2' non mappe, puis majuscule sur
    # la 1re lettre (le 'I' issu de '1', deja majuscule), style applique.
    # '2' n'a ni conversion ni glyphe de style -> reste un '2' nu.
    assert bot.convertir_texte("12abc", "cursive") == "\U0001d4d8" + "2" + "\U0001d4ea\U0001d4eb\U0001d4ec"  # 𝓘2𝓪𝓫𝓬


def test_convertir_texte_accent_en_bord_supprime():
    # COMPORTEMENT PINNE : 'café' -> nettoyer retire le 'é' final -> 'caf' -> style.
    assert bot.convertir_texte("café", "cursive") == "\U0001d4d2\U0001d4ea\U0001d4ef"  # 𝓒𝓪𝓯


def test_convertir_texte_accent_interne_traverse_le_style_inchange():
    # COMPORTEMENT PINNE : un accent interne survit a nettoyer mais n'a pas de
    # glyphe de style -> il traverse tel quel (style_map.get(char, char)).
    assert bot.convertir_texte("aéb", "cursive") == "\U0001d4d0" + "é" + "\U0001d4eb"  # 𝓐é𝓫


def test_convertir_texte_espace_interne_conserve():
    # COMPORTEMENT PINNE : un espace interne n'est ni en bord (pas supprime par
    # nettoyer) ni dans le style map -> conserve tel quel.
    assert bot.convertir_texte("a b", "cursive") == "\U0001d4d0" + " " + "\U0001d4eb"  # '𝓐 𝓫'


def test_convertir_texte_style_inconnu_renvoie_entree_brute():
    # COMPORTEMENT PINNE : style inconnu -> texte renvoye SANS aucun traitement
    # (ni nettoyage, ni chiffres, ni majuscule). Court-circuit en tete de fonction.
    assert bot.convertir_texte("hello", "inexistant") == "hello"
    assert bot.convertir_texte("...HELLO!!!", "inexistant") == "...HELLO!!!"


def test_convertir_texte_vide():
    assert bot.convertir_texte("", "cursive") == ""


def test_convertir_texte_que_des_caracteres_speciaux_donne_vide():
    # COMPORTEMENT PINNE : nettoyer supprime tout -> chaine vide en sortie.
    assert bot.convertir_texte("!!!###", "cursive") == ""


def test_convertir_texte_n_est_PAS_idempotent():
    # COMPORTEMENT PINNE (surprenant mais reel) : appliquer un style DEUX fois
    # DETRUIT la chaine. Les glyphes stylises sont non-[a-zA-Z0-9] : au 2e passage
    # nettoyer_pseudo les considere tous comme "speciaux" et les retire (bords),
    # et comme TOUTE la chaine est stylisee, il ne reste RIEN.
    une_fois = bot.convertir_texte("hello", "cursive")
    deux_fois = bot.convertir_texte(une_fois, "cursive")
    assert une_fois == "\U0001d4d7\U0001d4ee\U0001d4f5\U0001d4f5\U0001d4f8"  # 𝓗𝓮𝓵𝓵𝓸
    assert deux_fois == ""  # destruction totale


# ===================================================================
# 6. Troncature 32 caracteres (limite Discord)
# ===================================================================
#
# NOTE : la troncature `if len(x) > 32: x = x[:32]` vit DANS les handlers
# Discord (on_member_update, rename_slash, random_slash), PAS dans convertir_texte.
# On ne peut pas l'importer en pur. On pinne donc ICI la regle telle qu'appliquee
# par le bot, en la reproduisant a l'identique sur la sortie de convertir_texte,
# pour documenter l'invariant que la reecriture devra respecter.


def _appliquer_troncature_discord(pseudo: str) -> str:
    """Reproduction EXACTE de la regle des handlers (bot.py L157-158/318-319/373-374)."""
    if len(pseudo) > 32:
        pseudo = pseudo[:32]
    return pseudo


def test_troncature_compte_les_code_points_pas_les_octets():
    # COMPORTEMENT PINNE : len() en Python compte les CODE POINTS Unicode.
    # Un glyphe stylise hors BMP (ex cercles 🅐 = 1 code point >0xFFFF) compte
    # pour 1. La troncature a 32 garde donc 32 code points, pas 32 octets.
    source = "a" * 40  # 40 lettres -> 40 glyphes
    style_out = bot.convertir_texte(source, "cursive")
    # 1re lettre passe en majuscule (A) ; le reste en minuscule. 40 glyphes au total.
    assert len(style_out) == 40
    tronque = _appliquer_troncature_discord(style_out)
    assert len(tronque) == 32


def test_troncature_ne_touche_pas_les_pseudos_courts():
    out = bot.convertir_texte("renamio", "cursive")
    assert len(out) <= 32
    assert _appliquer_troncature_discord(out) == out
