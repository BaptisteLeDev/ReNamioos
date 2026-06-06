# User stories, ReNamioos v2

Stories reconstruites depuis le comportement réel du rewrite (TS/Bun, branche feat/rewrite-bun), pas depuis la doc des repos.
Session 2026-06-06, format DECISIONS.md D15.
Chaque commande, event et endpoint a sa story d'acceptation, critères tirés des tests bun:test existants.

## Story /ping : preuve de connexion avec latence

## Story

En tant qu'utilisateur d'un serveur Discord, je veux taper `/ping`, afin de vérifier que le bot est connecté et de connaître sa latence WebSocket.

## Comportement réel (référence code)

- Déclaration : `src/commands/ping.ts:11` (`SlashCommandBuilder().setName('ping')`).
- Réponse publique `Pong ! Latence: <ms>ms`, latence = `Math.max(0, Math.round(interaction.client.ws.ping))` (`src/commands/ping.ts:14-15`).
- Successeur du `/ping` legacy (`bot.py:246`, cf. `docs/caracterisation.md` ligne 116).

## Critères d'acceptation (tirés de src/commands/ping.test.ts)

- Given la commande est enregistrée, When on inspecte son schéma, Then elle se nomme `ping` et a une description non vide (`ping.test.ts:12-15`).
- Given une interaction avec `ws.ping = 42`, When `/ping` s'exécute, Then la réponse contient `Pong` (`ping.test.ts:17-30`).
- La latence affichée n'est jamais négative (plancher à 0, `ping.ts:14`).

## Notes

Écart documenté vs legacy : le préfixe emoji 🏓 du legacy n'est pas repris (le rewrite répond `Pong !` sans emoji).

## Story /styles : lister les 9 styles avec aperçu dérivé du domaine

## Story

En tant qu'utilisateur, je veux taper `/styles`, afin de voir tous les styles de police disponibles avec un aperçu réel de chacun.

## Comportement réel (référence code)

- Déclaration : `src/commands/styles.ts:14-17`.
- Embed titré `🎨 Styles disponibles`, un champ par style, chaque aperçu DÉRIVÉ du domaine via `apercuStyle(style)` (`styles.ts:24-30`, `src/commands/styliser.ts:37-40`) : aucun littéral UI à maintenir.
- Source des styles : `STYLE_NAMES` (`src/domain/styles.ts:21-31`), 9 entrées dont `scriptify`.
- Successeur de `styles_slash` (`bot.py:252`, `docs/caracterisation.md` ligne 117).

## Critères d'acceptation (tirés de src/commands/styles.test.ts)

- Given la commande, Then elle se nomme `styles` et a une description (`styles.test.ts:31-34`).
- Given `/styles` exécutée, Then l'embed contient exactement 9 champs = `STYLE_NAMES.length` (`styles.test.ts:36-43`).
- Given l'embed, Then `scriptify` figure parmi les champs (écart B4, `styles.test.ts:45-47`).
- Given chaque champ, Then son aperçu est non vide et dérivé du domaine, pas un littéral (`styles.test.ts:50-58`).

## Invariant clé

Impossible qu'un style chargé soit absent de l'UI : l'aperçu est calculé par `convertirTexte`, pas copié à la main (corrige le bug n°3 « scriptify fantôme », cf. ADR-0003 décision 1).

## Story /convert : styliser un texte sans renommer, avec refus propre

## Story

En tant qu'utilisateur, je veux taper `/convert <texte> <style>`, afin d'obtenir mon texte stylisé en glyphes Unicode sans renommer personne.

## Comportement réel (référence code)

- Déclaration + options `texte` (requis) et `style` (requis, autocomplete) : `src/commands/convert.ts:16-30`.
- Autocomplétion partagée : `src/commands/style-autocomplete.ts` (filtre `STYLE_NAMES` par sous-chaîne, aperçu dérivé, limite 25).
- Style inconnu → message éphémère `style-inconnu` AVANT d'appeler le domaine (`convert.ts:37-40`).
- Sinon appel `convertirTexte(texte, style)` (`src/domain/stylisation.ts:97`) ; si `ok:false` → message éphémère ; sinon embed `✨ Conversion` avec champs Original + Résultat (`convert.ts:42-55`).
- Successeur de `convert_slash` (`bot.py:218`, `docs/caracterisation.md` ligne 118).

## Critères d'acceptation (tirés de src/commands/convert.test.ts)

- Given la commande, Then elle se nomme `convert` et a une description (`convert.test.ts:40-42`).
- Given `texte=abc style=cursive`, When exécutée, Then un embed reprend l'original `abc` et le résultat stylisé `𝓐𝓫𝓬` (`convert.test.ts:45-53`).
- Given un style inexistant, Then réponse éphémère contenant `inconnu`, aucun embed (`convert.test.ts:55-61`).
- Given un texte déjà stylisé `𝓗𝓮𝓵𝓵𝓸`, Then refus propre éphémère `déjà stylisé`, aucun embed (`convert.test.ts:63-70`).

## Écart B4 (ADR-0003 décision 3)

Le domaine renvoie un Result discriminé : l'erreur métier (style inconnu, rien à styliser / déjà stylisé) devient un message éphémère, jamais un rendu vide ou fantaisiste.

## Story /rename : renommer un membre avec un style et garde-fous de permission

## Story

En tant que modérateur (permission Gérer les surnoms), je veux taper `/rename <membre> <style> [nouveau_nom]`, afin de renommer un membre avec un pseudo stylisé.

## Comportement réel (référence code)

- Déclaration + `setDefaultMemberPermissions(ManageNicknames)` + options membre/style(autocomplete)/nouveau_nom : `src/commands/rename.ts:23-40`.
- Défense en profondeur : revalidation de la permission de l'APPELANT (`rename.ts:47-53`).
- Style inconnu → éphémère (`rename.ts:55-59`) ; membre introuvable → éphémère (`rename.ts:61-65`).
- Source du nom = `nouveau_nom` sinon `nick` sinon `username` (`sourceRename`, `src/commands/styliser.ts:107-109`).
- Flux partagé `appliquerRename` : vérifie `member.manageable` (hiérarchie), stylise via domaine, tronque à 32 code points, `member.edit({nick})` ; toute erreur retourne un message prêt (`src/commands/styliser.ts:57-86`).
- Succès → embed vert `✅ Membre renommé` (`rename.ts:74-82`).
- Successeur de `rename_slash` (`bot.py:282`, `docs/caracterisation.md` ligne 119).

## Critères d'acceptation (tirés de src/commands/rename.test.ts)

- Given la commande, Then nom `rename`, description, `default_member_permissions` = ManageNicknames (`rename.test.ts:79-85`).
- Given `style=cursive nouveau_nom=abc`, Then `edit` est appelé avec `𝓐𝓫𝓬` et un embed est posté (`rename.test.ts:87-94`).
- Given aucun `nouveau_nom` et `nick=bob`, Then la source est le nick (`𝓑𝓸𝓫`), pas le nom global (`rename.test.ts:96-103`).
- Given appelant sans ManageNicknames, Then éphémère `permission`, AUCUN edit (`rename.test.ts:105-115`).
- Given style inconnu, Then refus propre éphémère, aucun edit (`rename.test.ts:117-123`).
- Given texte déjà stylisé, Then refus propre éphémère `déjà stylisé`, aucun edit (`rename.test.ts:125-132`).
- Given membre non gérable (hiérarchie), Then éphémère `hiérarchie`, aucun edit (`rename.test.ts:134-144`).
- Given `edit` qui lève (Forbidden bot), Then éphémère `permission`, pas de crash (`rename.test.ts:146-156`).

## Invariant clé

Troncature à 32 par CODE POINT (`tronquerPseudo`, `src/domain/stylisation.ts:125-131`) : ne casse pas une paire de substitution UTF-16 sur les glyphes hors BMP.

## Story /random : renommer un membre avec un style aléatoire

## Story

En tant que modérateur (permission Gérer les surnoms), je veux taper `/random <membre> [nouveau_nom]`, afin de renommer un membre avec un style choisi au hasard parmi les 9.

## Comportement réel (référence code)

- Déclaration + `setDefaultMemberPermissions(ManageNicknames)` + options membre/nouveau_nom (PAS d'option style) : `src/commands/random.ts:28-38`.
- Style tiré au hasard parmi `STYLE_NAMES` (`styleAleatoire`, `random.ts:22-26`) : toujours valide, donc pas de check de style.
- Réutilise le MÊME flux partagé `appliquerRename` que `/rename` (`random.ts:57`) : mêmes garde-fous (permission appelant, hiérarchie, refus propre, Forbidden bot).
- Succès → embed violet `🎲 Membre renommé (aléatoire)` (`random.ts:63-71`).
- Successeur de `random_slash` (`bot.py:344`, `docs/caracterisation.md` ligne 120).

## Critères d'acceptation (tirés de src/commands/random.test.ts)

- Given la commande, Then nom `random`, description, `default_member_permissions` = ManageNicknames (`random.test.ts:72-77`).
- Given un membre nommé `renamio`, Then `edit` est appelé avec une sortie non vide ET différente de la source (un vrai rendu stylisé), un embed est posté (`random.test.ts:79-86`).
- Given appelant sans permission, Then éphémère `permission`, aucun edit (`random.test.ts:88-97`).
- Given texte déjà stylisé, Then refus propre éphémère, aucun edit (`random.test.ts:99-106`).
- Given membre non gérable, Then éphémère `hiérarchie`, aucun edit (`random.test.ts:108-114`).

## Note

Les tests ne contrôlent pas le RNG : quel que soit le style tiré, les invariants observables tiennent (sortie non vide, != source).

## Story /aide : afficher l'aide avec compte de styles et de rôles dérivés

## Story

En tant qu'utilisateur, je veux taper `/aide`, afin de voir la liste des commandes, le nombre réel de styles et le nombre de rôles configurés pour l'auto-rename.

## Comportement réel (référence code)

- Fabrique `creerAideCommand(autoRenameMapping)` : la commande est une fermeture sur la config auto-rename injectée à la composition (`src/commands/aide.ts:19`, branchée dans `src/commands/index.ts:26` et `src/client.ts:41`).
- Embed `📖 Aide - ReNamioos` listant `/styles /convert /rename /random /ping` (`aide.ts:33-39`).
- Nombre de styles DÉRIVÉ de `STYLE_NAMES.length` (= 9), pas un littéral (`aide.ts:45`).
- Compte `Rôles configurés` = `Object.keys(autoRenameMapping).length` (`aide.ts:24,55`) : source UNIQUE issue de la config auto-rename (l'ancien ROLE_CONFIG legacy a été retiré).
- Successeur de `aide_slash` (`bot.py:399`, `docs/caracterisation.md` ligne 121).

## Critères d'acceptation (tirés de src/commands/aide.test.ts)

- Given la commande, Then nom `aide` et description (`aide.test.ts:31-35`).
- Given `/aide`, Then le texte annonce `9 styles` dérivé du domaine, avec garde-fou `STYLE_NAMES.length === 9` (`aide.test.ts:37-43`).
- Given `/aide`, Then les 5 commandes publiques `/styles /convert /rename /random /ping` sont listées (`aide.test.ts:45-52`).
- Given un mapping de 2 rôles, Then le texte affiche `Rôles configurés : 2` (`aide.test.ts:54-60`).

## Écart B4 (ADR-0003 décision 1)

Le legacy écrivait `8 styles` en dur et omettait `scriptify` ; le rewrite annonce le compte réel dérivé.

## Story auto-rename : styliser le pseudo à l'ajout d'un rôle mappé

## Story

En tant qu'administrateur de serveur, je veux qu'attribuer un rôle mappé à un membre déclenche le renommage automatique de son pseudo dans le style associé, afin de signaler visuellement son rôle sans action manuelle.

## Comportement réel (référence code)

- Event `guildMemberUpdate` abonné dans `src/client.ts:46-49` ; handler créé par `creerGestionnaireMembreMisAJour(deps)` (`src/events/guild-member-update.ts:52`).
- Détection PAR DIFF D'ENSEMBLES : `styleDeclenche(rolesAvant, rolesApres, mapping)` retourne le style du PREMIER roleId mappé parmi les rôles AJOUTÉS (`src/domain/auto-rename.ts:39-62`). Priorité = ordre des clés du fichier.
- Source = pseudo serveur sinon nom global via `sourceRename(newMember, null)` (`guild-member-update.ts:67`).
- Application via le MÊME flux partagé `appliquerRename` que /rename et /random (`guild-member-update.ts:68`).
- Tout échec (hiérarchie, Forbidden bot, refus propre du domaine) est tracé en `warn` STRUCTURÉ `{guildId, memberId, style, raison}`, jamais d'exception ni de silence (`guild-member-update.ts:70-77`).
- Config : mapping `roleId → styleName` chargé et validé zod au boot (`src/config/auto-rename-config.ts`), un style inconnu fait échouer le démarrage. Fichier par défaut `auto-rename.json` (`src/config.ts:22`).
- Intent privilégié GuildMembers requis et demandé (`src/client.ts:40`).
- Successeur de `on_member_update` (`bot.py:135`, `docs/caracterisation.md` § Auto-rename).

## Critères d'acceptation (tirés de src/events/guild-member-update.test.ts et src/domain/auto-rename.test.ts)

- Given un membre `nick=bob` qui gagne `role_cursive` (mappé cursive), Then le pseudo serveur est stylisé `𝓑𝓸𝓫` (source = nick prioritaire, écart B6 #1) (`guild-member-update.test.ts:73-82`).
- Given aucun nick serveur, Then la source est le nom global (`guild-member-update.test.ts:84-91`).
- Given un rôle ajouté NON mappé, Then aucun edit, aucun warn (`guild-member-update.test.ts:93-101`).
- Given un rôle mappé RETIRÉ, Then aucun edit (seuls les gains déclenchent, écart B6 vs réinit legacy) (`guild-member-update.test.ts:103-110`).
- Given un échange simultané à cardinalité égale (perd un rôle, gagne `role_cursive`), Then déclenche sur le gain (écart B6 #2 vs détection par cardinalité du legacy) (`guild-member-update.test.ts:112-120`).
- Given membre non gérable / edit Forbidden / refus propre déjà stylisé, Then warn structuré avec contexte, aucun crash (`guild-member-update.test.ts:122-153`).
- Given un mapping vide, Then jamais d'auto-rename (`guild-member-update.test.ts:155-169`).
- Priorité : gains multiples → premier roleId du fichier gagne (`src/domain/auto-rename.ts:52-62`).

## Écarts B6 actés (ADR-0004)

#1 source = nick ?? username (corrige bug n°6 `after.name`). #2 détection par diff d'ensembles (corrige bug n°7 cardinalité). Config `roleId → styleName` (ID stable) remplace `role.json` `styleName → [noms]`.

## Story endpoint /health : preuve de vie indépendante de Discord

## Story

En tant que système de monitoring de la flotte (bdf-monitor), je veux sonder `GET /health`, afin de savoir si le process ReNamioos est vivant, indépendamment de l'état de connexion Discord.

## Comportement réel (référence code)

- Route `app.get('/health')` retourne `{status:'ok', uptime: process.uptime()}` SANS aucune I/O Discord (`src/api/server.ts:44-45`).
- L'API Fastify est démarrée AVANT le bot Discord et un échec de login Discord ne fait pas tomber l'API (`src/index.ts:27-40`).
- L'API dépend du port `StatsProvider`, pas de discord.js (ACL ciblée, `src/api/server.ts:9-14`).

## Critères d'acceptation (tirés de src/api/contract.test.ts)

- Given un StatsProvider hors-ligne (bot non connecté), When `GET /health`, Then code 2xx (`contract.test.ts:29-35`).
- Given le même contexte, When `GET /health`, Then réponse en moins de 3 s sans I/O Discord (`contract.test.ts:37-45`).

## Note contrat

Source de vérité du contrat : monitoring `docs/contrat-cibles.md`. Les routes `/website/*` sont caduques (cf. DECISIONS.md D6).

## Story endpoint /stats : métriques métier au nom du contrat publié

## Story

En tant que système de monitoring de la flotte, je veux sonder `GET /stats`, afin de récupérer les métriques métier du bot aux noms imposés par le contrat (`guildCount`, `userCount`).

## Comportement réel (référence code)

- Route `app.get('/stats')` délègue à `statsProvider.getStats()` (`src/api/server.ts:47-48`).
- Le port `BotStats` impose les champs `guildCount`, `userCount`, `commandsToday`, `discordLatencyMs`, `version` (`src/api/stats-provider.ts:12-23`).
- L'adapter concret est `BotClient.getStats()` : `guildCount = guilds.cache.size`, `userCount = somme des memberCount`, `commandsToday` incrémenté à chaque interaction, `discordLatencyMs = ws.ping` arrondi (-1 si non connecté), `version = packageJson.version` (`src/client.ts:92-100`).
- Route racine `GET /` documente les endpoints (`src/api/server.ts:39-42`).

## Critères d'acceptation (tirés de src/api/contract.test.ts)

- Given le serveur, When `GET /stats`, Then code 200 et corps = objet JSON non nul, non tableau (`contract.test.ts:47-56`).
- Given le serveur, When `GET /stats`, Then `guildCount` et `userCount` sont de type `number` (noms du contrat, PAS `guilds`/`users`) (`contract.test.ts:58-66`).

## Note contrat

Les champs `guilds`/`users` sont caducs (DECISIONS.md D6). La suite de contrat verte est le gate d'onboarding au registre (D11).
