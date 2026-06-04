# Caractérisation de ReNamioos — comportement observable actuel

> **But.** Inventorier de façon exhaustive le comportement **observable et actuel**
> de ReNamioos (version Python, `bot.py`) AVANT sa réécriture en Bun/TypeScript
> (cf. [`decisions/0001-langage-cible-reecriture.md`](../decisions/0001-langage-cible-reecriture.md)).
> Ce document est le **cahier des charges de la réécriture** : la nouvelle
> implémentation doit reproduire ces comportements à l'identique, sauf décision
> explicite de correction (voir § Bugs pinnés).
>
> Les tests de [`tests/`](../tests/) automatisent le pinning de la **logique pure**.
> Ce document couvre en plus la couche Discord (commandes, événements) qui n'est
> pas testable hors I/O.
>
> **Périmètre** : lecture seule de `bot.py`, `styles.json`, `role.json`,
> `README.md`, `EXEMPLES.md`, `CONFIG.md`. `keep_alive.py` n'est pas couvert ici.

## Langage ubiquitaire du domaine

| Terme | Définition dans le domaine ReNamioos |
|---|---|
| **Style** | Une police Unicode nommée (ex. `cursive`, `gothique`) ⇒ une table de correspondance `caractère ASCII → glyphe Unicode`. Source : `styles.json`. |
| **Conversion (chiffres)** | Substitution leet-like `chiffre → lettre` appliquée avant le style (ex. `4 → A`). Source : clé `conversions` de `styles.json`. |
| **Pseudo / nick** | Le surnom (`nick`) d'un membre sur un serveur Discord, distinct de son `name` global. |
| **Rename** | Action d'écrire un nouveau `nick` sur un membre (`member.edit(nick=...)`). |
| **Auto-rename** | Rename déclenché automatiquement par un changement de rôle (`on_member_update`). |
| **Rôle stylisé** | Un rôle Discord listé dans `role.json` sous un style ⇒ son ajout/retrait pilote l'auto-rename. |
| **Nettoyage** | Retrait des caractères « spéciaux » (non `[a-zA-Z0-9]`) **aux extrémités** du pseudo. |
| **Capitalisation** | Mise en majuscule de la **première lettre** rencontrée. |
| **Texte stylisé** | Sortie de `convertir_texte` : pseudo nettoyé, chiffres convertis, capitalisé, puis mappé glyphe par glyphe. |

## Pipeline de conversion (`convertir_texte`)

Cœur métier. Fonction pure `convertir_texte(texte, style) -> str` (`bot.py:93`).

```
entrée ──► [0] court-circuit si style inconnu ──► entrée TELLE QUELLE
       └─► [1] nettoyer_pseudo      (retire les spéciaux en tête/queue)
           [2] convertir_chiffres   (0/1/3/4/5/7/8 → O/I/E/A/S/T/B)
           [3] mettre_majuscule_debut (1re LETTRE en majuscule)
           [4] mappage style         (char par char, get(char, char))
       ──► texte stylisé
```

Détail de chaque étape, avec invariants pinnés :

### [0] Style inconnu — court-circuit total
`bot.py:95-96`. Si `style not in STYLES`, la fonction **retourne l'entrée brute
sans aucun traitement** (ni nettoyage, ni chiffres, ni capitalisation).
→ pinné : `test_convertir_texte_style_inconnu_renvoie_entree_brute`.

### [1] Nettoyage (`nettoyer_pseudo`, `bot.py:69`)
Deux regex : `^[^a-zA-Z0-9]+` (préfixe) puis `[^a-zA-Z0-9]+$` (suffixe).
- Retire tous les caractères non alphanumériques **ASCII** en tête et en queue.
- Les espaces, points, tirets **internes** sont **conservés** (`a.b.c` → `a.b.c`).
- **PINNÉ (piège accents)** : `[a-zA-Z0-9]` ne couvre PAS les lettres accentuées.
  Un accent en **bord** est donc traité comme un spécial et **supprimé** :
  `café` → `caf`, `éhello` → `hello`. Un accent **interne** survit : `naïve` → `naïve`.

### [2] Conversion chiffres (`convertir_chiffres`, `bot.py:77`)
Remplace, dans tout le texte, chaque chiffre mappé par sa **lettre majuscule**.

| Chiffre | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Lettre | O | I | — | E | A | S | — | T | B | — |

- **PINNÉ** : `2`, `6`, `9` n'ont **aucun** mapping → ils restent des chiffres nus
  et, n'ayant pas non plus de glyphe de style, traversent jusqu'à la sortie tels quels.
- Implémentation par `str.replace` successifs ; sans risque de cascade ici car les
  valeurs de sortie (lettres) ne sont jamais des clés (chiffres).

### [3] Capitalisation (`mettre_majuscule_debut`, `bot.py:83`)
Met en majuscule la **première lettre** (`char.isalpha()`), pas le premier caractère.
- `12ab` → `12Ab` (le `1` puis `2` sont sautés, `a` → `A`).
- **PINNÉ** : `isalpha()` est vrai pour les glyphes Unicode déjà stylisés, mais leur
  `.upper()` les laisse identiques → un texte déjà stylisé n'est pas re-capitalisé.

### [4] Mappage du style (`bot.py:108-112`)
`resultat += style_map.get(char, char)` pour chaque caractère.
- Tout caractère absent de la table (espace, accent interne, chiffre non mappé,
  ponctuation interne) est **recopié tel quel**.
- **PINNÉ** : les styles `cercles` et `carres` mappent minuscule **et** majuscule
  vers le **même** glyphe (Unicode « enclosed » sans variante de casse). La
  capitalisation [3] n'a donc aucun effet visible pour ces deux styles.

## Les 9 styles (et non 8)

**PINNÉ — divergence doc/réalité.** `styles.json` définit **9** styles ; le README,
`/aide` et l'embed `/styles` annoncent et n'illustrent que **8** (`scriptify` est
absent des dictionnaires d'exemples UI mais bien chargé et fonctionnel).

| # | Nom (clé) | Échantillon `ReNamio` | Casse distincte ? | Hors BMP (emoji) ? |
|---|---|---|---|---|
| 1 | `cercles` | 🅡🅔🅝🅐🅜🅘🅞 | Non (min=maj) | Oui |
| 2 | `cursive` | 𝓡𝓮𝓝𝓪𝓶𝓲𝓸 | Oui | Oui |
| 3 | `gothique` | ℜ𝔢𝔑𝔞𝔪𝔦𝔬 | Oui | Partiel (ℜ,ℌ,ℑ,ℨ dans le BMP) |
| 4 | `gras` | 𝗥𝗲𝗡𝗮𝗺𝗶𝗼 | Oui | Oui |
| 5 | `monospace` | 𝚁𝚎𝙽𝚊𝚖𝚒𝚘 | Oui | Oui |
| 6 | `carres` | 🅁🄴🄽🄰🄼🄸🄾 | Non (min=maj) | Oui |
| 7 | `double` | ℝ𝕖ℕ𝕒𝕞𝕚𝕠 | Oui | Partiel (ℂ,ℍ,ℕ,ℙ,ℚ,ℝ,ℤ dans le BMP) |
| 8 | `fullwidth` | ＲｅＮａｍｉｏ | Oui | Non (tout dans le BMP) |
| 9 | `scriptify` | 𝒜ℬ𝒞… (non illustré en UI) | Oui | Partiel |

Chaque style couvre les **52 lettres ASCII** (26 min + 26 maj). **Aucun** style ne
mappe les chiffres `0-9`. Mappings exacts : voir `styles.json` (table autoritaire).

## Les 6 commandes slash

Toutes enregistrées via `@bot.tree.command` et synchronisées dans `on_ready`
(`bot.py:130`). Le préfixe `!` est configuré (`command_prefix="!"`, `bot.py:65`)
mais **PINNÉ** : aucun handler de commande préfixée n'est défini — contrairement à
ce qu'affirme le README (« commandes `!` aussi disponibles »), `!ping` etc.
**ne font rien**.

| Commande | Entrées | Sortie (succès) | Erreurs / cas | Réf. |
|---|---|---|---|---|
| `/ping` | — | Message `🏓 Pong ! Latence: <ms>ms` (public). | Aucune. | `bot.py:246` |
| `/styles` | — | Embed listant les styles via le dict `exemples` local. **PINNÉ** : ce dict ne contient pas `scriptify` → fallback `ReNamio` pour lui ; les styles itérés viennent de `STYLES.keys()` (donc 9 champs). | Aucune. | `bot.py:252` |
| `/convert` | `style` (autocomplete), `texte` | Embed `Original` + `Résultat` (public). | Si `style not in STYLES` → message éphémère `❌ Style inconnu`. | `bot.py:218` |
| `/rename` | `membre`, `style` (autocomplete), `nouveau_nom?` | `member.edit(nick=…)` + embed vert. Nom source = `nouveau_nom` sinon `membre.nick or membre.name`. Tronqué à 32. | Sans permission `manage_nicknames` (de l'**appelant**) → éphémère. `style` inconnu → éphémère. `discord.Forbidden` (bot) → éphémère. Autre exception → message `❌ Erreur: …`. | `bot.py:282` |
| `/random` | `membre`, `nouveau_nom?` | Style choisi par `random.choice(STYLES.keys())` ; reste identique à `/rename`. Embed violet. | Idem `/rename` (permission appelant, Forbidden bot, exception). **Pas** de check `style` (toujours valide). | `bot.py:344` |
| `/aide` | — | Embed d'aide. **PINNÉ** : annonce « 8 styles » (en dur) et liste 5 commandes (omet `/aide` elle-même). | Aucune. | `bot.py:399` |

### Autocomplétion du style (`bot.py:191`)
- Filtre `STYLES.keys()` par sous-chaîne insensible à la casse de la saisie.
- Affiche `Nom.capitalize() - <échantillon ABC>`. **PINNÉ** : le dict `exemples`
  d'autocomplétion **inclut** `scriptify` (`𝒜ℬ𝒞`), contrairement à celui de `/styles`.
- Tronqué aux 25 premiers choix (limite Discord ; ici sans effet, 9 < 25).

## Auto-rename sur rôles (`on_member_update`, `bot.py:135`)

Déclencheur : tout `on_member_update` où `before.roles != after.roles`.

### Ajout de rôle (`len(before.roles) < len(after.roles)`)
1. Identifie le **premier** rôle présent dans `after` et absent de `before`.
2. Parcourt `ROLE_CONFIG` ; au **premier** style dont la liste contient
   `new_role.name`, applique `convertir_texte(after.name, style)`.
   - **PINNÉ** : la source du rename est `after.name` (nom **global**), pas le `nick`.
   - Tronque à 32 caractères (`nick = nick[:32]`).
   - `await after.edit(nick=…)`.
   - `break` après le premier style correspondant (un seul rename par événement).

### Retrait de rôle (`len(before.roles) > len(after.roles)`)
1. Identifie le **premier** rôle retiré.
2. Si ce rôle figure dans un style de `ROLE_CONFIG` → `after.edit(nick=None)`
   (réinitialisation au pseudo par défaut). `break` au premier match.

### Priorités et limites pinnées
- **Ordre des styles** = ordre d'insertion des clés de `role.json` (dict Python 3.7+
  ordonné). Le premier style listant le rôle gagne. Aujourd'hui `role.json` n'a
  qu'un style (`scriptify`, 9 entrées) → pas d'ambiguïté observable.
- **PINNÉ (détection par cardinalité)** : la branche est choisie en comparant les
  **longueurs** des listes de rôles. Un échange simultané (un rôle gagné + un perdu,
  même cardinalité) **n'est traité ni en ajout ni en retrait** → aucun rename.
- **Multi-changements** : si plusieurs rôles changent d'un coup, seul le `next(...)`
  (premier trouvé) est considéré.
- **Permissions** : `discord.Forbidden` est attrapée et **loggée seulement**
  (pas d'effet visible côté utilisateur ; l'auto-rename échoue silencieusement).
- Aucune vérification que le rename produit un pseudo non vide (voir bug § ci-dessous).

## Cas limites et entrées exotiques (pinnés)

| Entrée / situation | Sortie observée | Test |
|---|---|---|
| Pseudo vide `""` | `""` (chaîne vide) | `test_convertir_texte_vide` |
| Que des spéciaux `!!!###` | `""` (nettoyage supprime tout) | `test_convertir_texte_que_des_caracteres_speciaux_donne_vide` |
| `> 32` caractères | Tronqué à 32 **code points** (pas octets) côté handlers Discord | `test_troncature_*` |
| Texte **déjà stylisé** re-converti | **DESTRUCTION** → `""` (voir bug ci-dessous) | `test_convertir_texte_n_est_PAS_idempotent` |
| Accent en bord (`café`) | Accent supprimé (`𝓒𝓪𝓯`) | `test_convertir_texte_accent_en_bord_supprime` |
| Accent interne (`aéb`) | Accent conservé non stylisé (`𝓐é𝓫`) | `test_convertir_texte_accent_interne_traverse_le_style_inchange` |
| Espace interne (`a b`) | Espace conservé (`𝓐 𝓫`) | `test_convertir_texte_espace_interne_conserve` |
| Chiffre non mappé (`2`,`6`,`9`) | Recopié tel quel | `test_convertir_chiffres_non_mappes_inchanges` |

### Troncature 32 et glyphes hors BMP — risque pinné
La troncature est `nick[:32]` sur des **code points Python**. Beaucoup de glyphes
(`cercles`, `carres`, et la majorité des styles « mathematical ») sont **hors BMP**
(1 code point logique, mais 2 unités UTF-16 / 4 octets UTF-8). Discord compte les
pseudos en **code points** également, donc la limite tient ; mais la réécriture en
JS/TS devra utiliser un découpage **par code point** (`[...str].slice(0,32)`) et
**non** `str.slice(0,32)` (qui coupe en unités UTF-16 et peut casser une paire de
substitution). À tester explicitement côté Bun/TS.

## Bugs pinnés (NON corrigés — décisions à prendre lors de la réécriture)

Ces comportements sont **figés tels quels** par les tests. Ils sont documentés ici
pour que la réécriture décide explicitement de les **reproduire** ou les **corriger**
(une correction = un changement de comportement assumé, pas un effet de bord).

1. **Non-idempotence destructrice.** Appliquer un style à un texte **déjà stylisé**
   renvoie `""`. Cause : les glyphes stylisés ne sont pas `[a-zA-Z0-9]`, donc
   `nettoyer_pseudo` les considère tous comme spéciaux ; comme toute la chaîne l'est,
   elle est intégralement rognée. **Impact réel** : relancer `/rename` sur un membre
   déjà renommé, ou réappliquer l'auto-rename, peut produire un `nick` vide.
   *Cf. aussi* : `member.edit(nick="")` côté Discord ⇒ réinitialise au nom global
   (le vide n'est pas accepté comme surnom).

2. **Accents perdus en bord.** `café` → `caf`. Les utilisateurs francophones avec un
   pseudo terminant par une lettre accentuée perdent ce caractère.

3. **`scriptify` fantôme dans l'UI.** 9 styles chargés, mais `/styles`, `/aide` et le
   README n'en exposent que 8. `scriptify` est utilisable via `/convert scriptify …`
   et est le **seul** style câblé à des rôles dans `role.json`.

4. **Chiffres 2/6/9 non convertis.** Incohérence du mapping leet (les autres chiffres
   le sont). Ces chiffres restent visibles « en clair » dans un pseudo stylisé.

5. **Commandes préfixe `!` inexistantes.** `command_prefix="!"` est défini mais aucun
   `@bot.command` n'existe. Le README ment en annonçant `!ping`, etc.

6. **Auto-rename basé sur `after.name`, pas `after.nick`.** Le nom **global** est
   stylisé, ignorant un éventuel surnom serveur déjà posé.

7. **Échec silencieux sur cardinalité égale.** Un changement de rôles à cardinalité
   constante (un ajout + un retrait simultanés) ne déclenche aucun auto-rename.

## Sources autoritaires

| Comportement | Source de vérité |
|---|---|
| Tables de glyphes par style | `styles.json` |
| Mapping chiffres → lettres | clé `conversions` de `styles.json` |
| Rôles → styles (auto-rename) | `role.json` |
| Pipeline & handlers | `bot.py` |
| Logique pure pinnée (exécutable) | `tests/test_characterization.py` |
