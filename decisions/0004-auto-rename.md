# ADR-0004 — Auto-rename par rôles (lot B6)

- **Statut** : accepté · **Date** : 2026-06-04
- **Contexte amont** : [ADR-0001](0001-langage-cible-reecriture.md) (Bun/TS, ReNamioos pilote),
  [ADR-0002](0002-pattern-starter.md) (domaine pur, ACL ciblée, config fichier sans DB),
  [ADR-0003](0003-corrections-comportements-pinnes.md) (corrections B4),
  [`docs/caracterisation.md`](../docs/caracterisation.md) (§ Auto-rename, bugs pinnés n°6 et n°7).

## Contexte

Le legacy `on_member_update` (`bot.py:135`) renomme automatiquement un membre quand son
ensemble de rôles change. Son comportement, **figé par la caractérisation** (§ Auto-rename),
portait deux comportements surprenants explicitement laissés à trancher en B6 (cf.
[ADR-0003](0003-corrections-comportements-pinnes.md), § Contexte — « relèvent de la couche
Discord/événements ») :

- **Bug n°6** — la source du rename est `after.name` (**nom global**), ignorant un éventuel
  pseudo serveur (`nick`) déjà posé.
- **Bug n°7** — la branche (ajout vs retrait) est choisie en comparant les **cardinalités** des
  listes de rôles. Un échange simultané (un rôle gagné + un perdu, **même cardinalité**) ne
  déclenche **rien**.

Le mapping rôle→style legacy vivait dans `role.json` (`styleName → [noms de rôles]`) et avait
été copié tel quel en B3 (`src/domain/data/roles.json` + export `ROLE_CONFIG`), sans être
réellement câblé à un événement. B6 porte enfin l'événement et **tranche** la forme de la config.

## Décisions

### 1. Source du renommage = pseudo SERVEUR sinon nom global (ÉCART VOLONTAIRE B6, corrige bug n°6)

L'auto-rename stylise le **pseudo serveur** (`member.nickname`) du membre s'il existe, **sinon**
son **nom global** (`user.username`). Le `after.name` systématique du legacy est abandonné : il
écrasait un surnom serveur que l'utilisateur (ou un admin) avait délibérément posé.

Concrètement, l'adapter délègue à `sourceRename(membre, null)` (déjà partagé par `/rename` et
`/random`, cf. [`src/commands/styliser.ts`](../src/commands/styliser.ts)) : `nickname ?? username`.
La sémantique de la source est donc **identique** à celle des commandes manuelles — un seul
endroit décide « quel texte styliser ».

### 2. Détection par DIFF D'ENSEMBLES de rôles (ÉCART VOLONTAIRE B6, corrige bug n°7)

La détection ne compare plus les tailles. On calcule l'**ensemble des rôles ajoutés**
(`après \ avant`) ; **tout rôle ajouté** est un déclencheur potentiel, indépendamment des rôles
perdus. Conséquences :

- un **échange simultané à cardinalité égale** (un rôle mappé gagné + un autre perdu) **déclenche**
  désormais sur le rôle gagné ;
- les **rôles retirés ne déclenchent rien** (l'auto-rename est piloté par les **gains**). La
  ré-initialisation `nick = None` du legacy lors d'un retrait n'est **pas** reprise : elle reposait
  sur le même mécanisme de cardinalité et écrasait silencieusement un surnom ; un retrait laisse
  désormais le pseudo en place (le membre ou un admin le change s'il le souhaite).

Échec de renommage (hiérarchie de rôles, permission Discord manquante, ou **refus propre** du
domaine `'rien-à-styliser'` sur un texte déjà stylisé) → **log structuré `warn`** avec contexte
`{ guildId, memberId, style, raison }`. **Jamais** d'exception remontée, **jamais** de silence
(contrairement au legacy qui n'attrapait que `discord.Forbidden` et loggait en `print`).

### 3. Config FICHIER `roleId → styleName`, validée zod au boot (successeur de `role.json`)

Conforme à [ADR-0002](0002-pattern-starter.md) (config fichier, **aucune DB**). Le mapping passe
de `styleName → [noms de rôles]` (legacy) à **`roleId → styleName`** :

- **par identifiant** (et non par nom) : un ID de rôle est **stable** (renommer le rôle côté
  Discord ne casse pas la config), contrairement aux noms emoji-préfixés du legacy ;
- **un style par rôle** : c'est le sens métier réel (un rôle confère **un** style). Le legacy
  inversait la relation par accident d'implémentation.
- **`scriptify`** — seul style câblé à des rôles dans le `role.json` legacy — reste un style
  **mappable de plein droit** (officialisé en B4, [ADR-0003](0003-corrections-comportements-pinnes.md)).

**Validation au boot** (`src/config/auto-rename-config.ts`) : chaque valeur doit être l'un des 9
styles chargés (`zod.enum(STYLE_NAMES)`). Un **style inconnu** (ou un fichier absent / un JSON
malformé) lève une **erreur de boot explicite** — le bot ne démarre pas avec un auto-rename
partiellement cassé. Aucun catch silencieux.

**Priorité = ordre du fichier.** Si un membre gagne **plusieurs** rôles mappés d'un coup, le style
retenu est celui du **premier `roleId` déclaré dans le fichier** (l'objet JSON préserve l'ordre
d'insertion des clés, et zod le conserve). La priorité est donc **explicite et éditable** : pour
qu'un rôle l'emporte, on le place plus haut dans `auto-rename.json`. L'ordre d'apparition côté
Discord n'a aucune influence.

**Chemin configurable** : `AUTO_RENAME_CONFIG_PATH` (défaut `auto-rename.json` à la racine). Un
exemple committé documente la forme : [`auto-rename.example.json`](../auto-rename.example.json).

## Conséquences

- **Domaine pur** : `src/domain/auto-rename.ts` (`rolesAjoutes`, `styleDeclenche`,
  `MappingRoleStyle`) ne dépend de **rien** (pas de discord.js). Testé en mémoire sur des ensembles
  d'identifiants (`src/domain/auto-rename.test.ts`). L'invariant ACL ciblée d'ADR-0002 tient.
- **Adapter** : `src/events/guild-member-update.ts` traduit l'événement Discord vers le domaine et
  applique via le flux **partagé** `appliquerRename` (anti-duplication : même chemin que `/rename` et
  `/random` — hiérarchie, stylisation, troncature 32 code points, edit). Le logger est un **seam**
  injectable (testable sans I/O réelle).
- **Provenance unique** : l'ancien `ROLE_CONFIG` / `src/domain/data/roles.json` (copie du
  `role.json` legacy) est **supprimé**. Il n'existe plus qu'**une** source rôle→style :
  `auto-rename.json`. Le compte « Rôles configurés » de `/aide` en est désormais dérivé
  (`creerAideCommand(mapping)`), supprimant la double source qui violait le mandat de provenance
  (`ARCHITECTURE.md`).
- **Intent privilégié** : `guildMemberUpdate` n'arrive que si l'intent **GuildMembers** (SERVER
  MEMBERS INTENT, **privilégié**) est activé dans le Dev Portal Discord. `src/client.ts` le demande
  en plus de `Guilds` (les autres intents restent minimaux). À documenter / activer avant la
  bascule (README, ARCHITECTURE).
- **Harnais de caractérisation** : le pin `test_role_config_pinne` (forme du `role.json` legacy)
  est **retiré** — sa source de vérité n'existe plus. Remplacé par les suites B6 (domaine + config).
- **Legacy** : `bot.py` reste intact jusqu'à B7. Ces décisions ne vivent que dans la réécriture TS.

## Alternatives écartées

- **Reproduire `after.name` (bug n°6).** Écarté par décision utilisateur : écraser un surnom
  serveur délibéré est hostile. La source unifiée `nick ?? name` est cohérente avec `/rename`.
- **Détection par cardinalité (bug n°7).** Écarté : l'échange simultané passait inaperçu. Le diff
  d'ensembles est robuste et exprime le sens réel (« quels rôles ont été gagnés »).
- **Ré-initialiser le pseudo au retrait d'un rôle (`nick = None`).** Écarté : reposait sur la
  cardinalité, écrasait silencieusement un surnom, et n'a pas d'équivalent « gain » symétrique
  propre. Un retrait laisse le pseudo en place ; le rename est piloté par les **gains** seuls.
- **Config `styleName → [roleIds]` (forme inversée du legacy).** Écartée : le sens métier est
  « un rôle ⇒ un style », pas « un style ⇒ N rôles ». La forme `roleId → styleName` rend la
  priorité (ordre des clés) lisible et interdit qu'un rôle pointe vers deux styles.
- **Matcher par NOM de rôle (comme le legacy).** Écarté : un nom de rôle change (et les noms
  legacy étaient des libellés emoji fragiles). L'ID est stable et non ambigu.
- **Persistance en base (Neon).** Écartée pour les mêmes raisons qu'en [ADR-0002](0002-pattern-starter.md) :
  donnée petite, modifiée par commit, aucun besoin d'I/O dans le chemin chaud.
- **Logger global / `console.log` direct (legacy).** Écarté : le seam `LoggerAutoRename` rend
  l'échec **testable** et le log **structuré** (contexte exploitable par le monitoring), sans
  catch silencieux.
