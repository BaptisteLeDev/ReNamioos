/**
 * Logique PURE de l'auto-rename par roles (B6, cf. decisions/0004-auto-rename.md).
 *
 * Successeur du `on_member_update` legacy (bot.py:135), porte derriere deux
 * ECARTS VOLONTAIRES vis-a-vis du comportement pinne (docs/caracterisation.md
 * § Auto-rename) :
 *
 *  1. DETECTION PAR DIFF D'ENSEMBLES. Le legacy choisissait sa branche en
 *     comparant les CARDINALITES des listes de roles (bug pinne n°7) : un echange
 *     simultane a cardinalite egale ne declenchait rien. Ici, on calcule
 *     l'ensemble des roles AJOUTES (apres \ avant) ; tout role ajoute est un
 *     declencheur potentiel, independamment des roles perdus.
 *
 *  2. PRIORITE = ORDRE DU FICHIER. Si un membre gagne plusieurs roles mappes d'un
 *     coup, le style retenu est celui du PREMIER roleId declare dans le mapping
 *     (l'ordre des cles du fichier de config fait foi), pas l'ordre d'apparition
 *     cote Discord.
 *
 * Aucune dependance a discord.js : on ne manipule que des identifiants de roles
 * (string) et un mapping. L'adapter (src/events/guild-member-update.ts) traduit
 * les objets Discord vers ces primitives et applique le resultat via le flux
 * partage `appliquerRename` (anti-duplication, cf. src/commands/styliser.ts).
 */
import type { StyleName } from './styles';

/**
 * Mapping ORDONNE roleId -> nom de style. L'ordre d'insertion des cles encode la
 * PRIORITE (ADR-0004) : le premier roleId mappe gagne en cas de gains multiples.
 * Charge et valide a la frontiere (src/config/auto-rename-config.ts) ; le domaine
 * le recoit deja valide (chaque valeur est un StyleName connu).
 */
export type MappingRoleStyle = Record<string, StyleName>;

/**
 * Ensemble des roles AJOUTES : presents dans `apres`, absents d'`avant`. Conserve
 * l'ordre d'apparition dans `apres`. Remplace la detection par cardinalite du
 * legacy (ECART VOLONTAIRE B6 #1).
 */
export function rolesAjoutes(avant: readonly string[], apres: readonly string[]): string[] {
  const ensembleAvant = new Set(avant);
  return apres.filter((roleId) => !ensembleAvant.has(roleId));
}

/**
 * Style a appliquer suite a un changement de roles, ou `null` si aucun.
 *
 * On parcourt le MAPPING dans l'ordre de ses cles (= ordre du fichier = priorite)
 * et on retourne le style du premier roleId mappe qui figure parmi les roles
 * ajoutes. Ainsi, en cas de gains multiples, la priorite du fichier l'emporte sur
 * l'ordre cote Discord (ECART VOLONTAIRE B6 #2).
 */
export function styleDeclenche(
  avant: readonly string[],
  apres: readonly string[],
  mapping: MappingRoleStyle,
): StyleName | null {
  const ajoutes = new Set(rolesAjoutes(avant, apres));
  for (const [roleId, style] of Object.entries(mapping)) {
    if (ajoutes.has(roleId)) return style;
  }
  return null;
}
