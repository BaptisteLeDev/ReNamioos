# ADR-0003 — Corrections des comportements pinnés (lot B4)

- **Statut** : accepté · **Date** : 2026-06-04
- **Contexte amont** : [ADR-0001](0001-langage-cible-reecriture.md) (Bun/TS, ReNamioos pilote),
  [ADR-0002](0002-pattern-starter.md) (domaine pur, ACL ciblée),
  [`docs/caracterisation.md`](../caracterisation.md) (§ Bugs pinnés).

## Contexte

Le domaine de stylisation (B3) a été porté à **parité stricte** avec le `bot.py` legacy,
**bugs pinnés compris** : le harnais de caractérisation (`stylisation.test.ts`) fige le
comportement *actuel*, pas le comportement *souhaité*. Les sept comportements surprenants
listés dans [`docs/caracterisation.md`](../caracterisation.md) (§ Bugs pinnés) étaient
en attente d'une décision **explicite** : reproduire à l'identique, ou corriger en connaissance
de cause (jamais par accident — c'est le mandat d'ADR-0001/0002).

Quatre de ces comportements sont **corrigés** par la présente décision (actée par l'utilisateur,
lot B4). Les trois autres (commandes préfixe `!` inexistantes, auto-rename basé sur `after.name`,
échec silencieux sur cardinalité égale) relèvent de la couche Discord/événements et **ne sont
pas tranchés ici** — ils seront traités avec le port de `on_member_update` (B6).

Chaque correction est un **ÉCART VOLONTAIRE** vis-à-vis du comportement pinné. Les tests du
harnais touchés portent un commentaire `ÉCART VOLONTAIRE (B4): …` ; tous les autres restent à
parité stricte.

## Décisions

### 1. `scriptify` officialisé — 9 styles publics

**Avant (pinné).** `styles.json` charge **9** styles, mais `/styles`, `/aide` et le README
n'en exposent que **8** : `scriptify` était fonctionnel via `/convert scriptify …` mais
**fantôme** dans l'UI (cf. `docs/caracterisation.md`, bug n°3). C'est pourtant le **seul**
style câblé à des rôles dans `roles.json` (auto-rename).

**Décision.** `scriptify` devient un style **public de plein droit** : exposé dans `/styles`
(avec aperçu), dans `/aide` (« 9 styles ») et dans la documentation. Plus de divergence
doc/réalité : la table autoritaire (`STYLES`, 9 entrées) est la seule source de vérité de l'UI.

**Conséquence.** Plus aucun dictionnaire d'exemples « UI » partiel (le legacy avait deux dicts
`exemples` désynchronisés : celui de `/styles` omettait `scriptify`, celui de l'autocomplétion
l'incluait). Les aperçus sont dérivés du **domaine** (un échantillon stylisé par `convertirTexte`),
pas d'un littéral maintenu à la main → impossible qu'un style chargé soit absent de l'UI.

### 2. Accents préservés partout (plus de rognage en bord)

**Avant (pinné).** `nettoyerPseudo` retire les caractères non `[a-zA-Z0-9]` **ASCII** aux
extrémités. Une lettre accentuée n'étant pas ASCII, un accent **en bord** était supprimé
(`café` → `caf`, `éhello` → `hello`), alors qu'un accent **interne** survivait (`naïve` → `naïve`).
Comportement incohérent et hostile aux pseudos francophones (cf. bug n°2).

**Décision.** Les **lettres** (au sens Unicode `\p{L}`) sont **préservées partout**, y compris
les accents en bord. Le nettoyage ne retire plus que la ponctuation / les symboles / espaces
non-lettres-non-chiffres aux extrémités. Les accents restent **non stylisés** (aucun style ne
mappe `é`, `ï`, …) et traversent donc tels quels — exactement comme c'était déjà le cas pour
les accents *internes*. On homogénéise : un accent est traité pareil quelle que soit sa position.

**Conséquence.** `café` → style appliqué à `caf` + `é` non stylisé (`𝓒𝓪𝓯é`), `éhello` → `Éhello`
stylisé. La capitalisation de la première lettre s'applique désormais à un accent en tête s'il
y en a un (`é`.toUpperCase() = `É`). Le nettoyage des extrémités vise les **non-lettres-non-chiffres**
(`\p{L}` et chiffres `0-9` conservés ; le reste rogné en bord), ce qui change `nettoyerPseudo`.

### 3. Re-styliser un texte déjà stylisé → refus propre (erreur métier)

**Avant (pinné).** Appliquer un style à un texte **déjà stylisé** renvoyait `""` : les glyphes
stylisés ne sont pas `[a-zA-Z0-9]`, donc `nettoyerPseudo` les considérait tous comme spéciaux
et rognait toute la chaîne (non-idempotence **destructrice**, bug n°1). Combiné à `member.edit(nick="")`,
cela réinitialisait le pseudo au nom global — silencieusement.

**Décision.** **Pas de dé-stylisation magique.** Le refus propre se déclenche quand il n'y a
**rien à styliser**. La **matière** du style est la **lettre ASCII `[A-Za-z]`** : c'est le seul
caractère qu'une table de glyphes transforme (les chiffres sont d'abord convertis en lettres
ASCII par l'étape [2], donc couverts). Si, après nettoyage + conversion des chiffres, le texte
ne contient **aucune lettre ASCII**, le domaine renvoie une **erreur métier explicite** et
**aucun rendu**. Ce cas couvre :
- l'entrée vide `""` ;
- une entrée ne contenant que des symboles (`!!!###`) ;
- un texte **déjà stylisé** : ses glyphes sont des lettres Unicode (`\p{L}`) mais **pas** des
  lettres ASCII → rien à styliser → refus. Message côté commandes : « ce texte est déjà stylisé ».

**Interaction décision 2 ↔ décision 3 (important).** La décision 2 (accents/lettres préservés)
**supprime le mécanisme destructeur** d'origine : sous l'ancien `nettoyerPseudo`, re-styliser
vidait la chaîne (`""`) car les glyphes étaient rognés. Avec la décision 2, les glyphes (lettres
Unicode) **survivent** au nettoyage ; la chaîne n'est donc **plus vide**. Détecter « déjà stylisé »
par la **vacuité** ne suffit plus. On bascule sur le **critère robuste** « absence de lettre ASCII
stylisable », qui capture les trois cas ci-dessus de façon cohérente, que la chaîne soit vide ou
pleine de glyphes.

**Décision de type (états invalides irreprésentables).** `convertirTexte` ne renvoie plus un
`string` qui peut sournoisement valoir `""` (ou un texte intact non stylisé), mais un **`Result`**
discriminé :

```ts
type ResultatStylisation =
  | { ok: true; texte: string }
  | { ok: false; erreur: ErreurStylisation };
```

`ErreurStylisation` est une union fermée : `'style-inconnu'`, `'rien-a-styliser'`. Le « texte
sans matière stylisable » cesse d'être un état valide silencieux : il devient un cas `ok: false`
que l'appelant **doit** traiter (le type l'y force). Les commandes traduisent chaque variante
d'erreur en message Discord éphémère ; aucune ne peut écrire un `nick` vide ni un pseudo non
stylisé par accident.

**Conséquence.** Le court-circuit « style inconnu » devient lui aussi un `ok: false`
(`'style-inconnu'`) au lieu de renvoyer l'entrée brute — cohérent avec un type qui rend
l'échec explicite. Les helpers de pipeline (`nettoyerPseudo`, `convertirChiffres`,
`mettreMajusculeDebut`) restent des fonctions `string -> string` pures et inchangées dans leur
signature ; seul `convertirTexte` (l'API publique) passe au `Result`.

### 4. Mapping chiffres complété : 2→Z, 6→G, 9→G

**Avant (pinné).** Le mapping leet ne couvrait que 7 chiffres (`0/1/3/4/5/7/8`) ; `2`, `6`, `9`
restaient des chiffres nus, visibles « en clair » dans un pseudo stylisé (bug n°4).

**Décision.** Le mapping est **complété** pour couvrir les 10 chiffres. Choix exact des trois
ajouts (leet-speak usuel) :

| Chiffre | 2 | 6 | 9 |
|---|---|---|---|
| Lettre  | Z | G | G |

- **2 → Z** : forme du `2` proche d'un `Z` (leet-speak courant).
- **6 → G** : le `6` rappelle un `G` minuscule ; `9` aussi (boucle + jambe). Les deux pointent
  vers **G** (collision assumée : aucune ambiguïté à la lecture d'un pseudo, et la majuscule
  `G` existe dans les 9 styles).

Les lettres ajoutées sont des **MAJUSCULES** (cohérent avec le mapping existant : `0→O`, `1→I`, …).
Aucune lettre de sortie n'est un chiffre → toujours aucune cascade dans `convertirChiffres`.

**Conséquence.** `convertirChiffres('0123456789')` → `'OIZEASGTBG'` (plus aucun chiffre nu).
Tous les chiffres deviennent des lettres et sont donc **stylisés** par la table de glyphes.

## Conséquences transverses

- **Tests du harnais.** Les tests pinnant les 4 comportements corrigés sont **modifiés** et
  marqués `ÉCART VOLONTAIRE (B4): …`. Les autres restent à parité stricte. La RED est constatée
  d'abord (le test corrigé échoue contre l'ancien domaine), puis le domaine est corrigé (GREEN).
  Touchés : `test_conversions_chiffres_mapping_exact`, `test_aucun_style_ne_mappe_les_chiffres`
  (les chiffres deviennent des lettres → restent absents des tables, invariant conservé mais
  raison documentée), `test_nettoyer_pseudo_supprime_accents_en_bord` → devient
  `…_conserve_accents_en_bord`, `test_convertir_chiffres_non_mappes_inchanges` →
  `…_tous_mappes`, `test_convertir_texte_accent_en_bord_supprime` → `…_accent_en_bord_preserve`,
  `test_convertir_texte_n_est_PAS_idempotent` → `…_deja_stylise_refus_propre` (`ok: false`,
  `'rien-a-styliser'`), `test_convertir_texte_style_inconnu_renvoie_entree_brute` →
  `…_style_inconnu_erreur_metier` (`ok: false`, `'style-inconnu'`), et le passage de toutes les
  assertions `convertirTexte(...)` au déballage du `Result` (helper `attenduOk`).
- **`scriptify`.** L'aperçu de `/styles` est désormais dérivé du domaine (pas de littéral UI à
  maintenir) → aucun style chargé ne peut être absent de l'UI.
- **Landing (`feat/website`).** La landing affiche **8** styles ; elle devra passer à **9** quand
  la réécriture shippe (B7). **Non modifiée par ce lot** (cf. prNotes B5).
- **Compatibilité legacy.** `bot.py` reste **intact** jusqu'à la bascule (B7). Ces corrections
  ne vivent que dans la réécriture TS.

## Alternatives écartées

- **Reproduire les 4 bugs (statu quo).** Écarté : l'utilisateur a tranché en B4. Les bugs étaient
  hostiles (accents perdus, pseudo vidé silencieusement) ou incohérents (mapping partiel, style
  fantôme).
- **Dé-styliser automatiquement un texte déjà stylisé** (table inverse glyphe→ASCII). Écarté :
  « pas de dé-stylisation magique » (décision utilisateur). Coûteux (table inverse pour 9 styles),
  ambigu (collisions `cercles`/`carres` min=maj) et surprenant. Un refus propre est plus honnête.
- **`convertirTexte` renvoie `string | null`.** Écarté : `null` ne porte pas la *raison* de
  l'échec (style inconnu vs rien à styliser) → l'appelant ne peut pas choisir le bon message. Le
  `Result` discriminé rend chaque cause explicite et le `switch` exhaustif vérifiable par le type.
- **Détecter « déjà stylisé » par la vacuité après nettoyage.** Écarté : la décision 2 fait
  survivre les glyphes (lettres Unicode) au nettoyage → la chaîne n'est plus vide. On détecte
  donc par l'**absence de lettre ASCII stylisable**, robuste quelle que soit la composition.
- **2/6/9 → autres lettres** (`6→b`, `9→p`…). Écarté : `Z`/`G`/`G` sont les correspondances
  leet les plus lisibles ; la collision `6=9=G` est sans conséquence pratique et documentée.
