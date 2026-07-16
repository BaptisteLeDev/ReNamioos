/**
 * Domaine PUR de l'evenement stylise (« Style Party », proposition ReNamioos axe metier, L).
 *
 * Un admin programme une periode (`/event start style: duree: role:`) pendant laquelle les
 * membres d'un role (hors opt-out) sont stylises, avec REVERT AUTO a l'echeance. Le revert
 * individuel reutilise la persistance #25/#38 (OriginalNickStore.rememberWithDeadline) et le
 * job de balayage (sweep-temporaire) ; ce module ne contient que les DECISIONS pures, sans
 * I/O ni discord.js (invariant ACL, ADR-0002).
 */
import type { StyleName } from "./styles";

/**
 * Un evenement stylise programme d'une guilde. `expiresAt` (epoch ms) : le revert massif est
 * pilote par cette echeance (chaque membre est memorise avec elle). Value object immuable.
 */
export interface EvenementStyle {
  readonly guildId: string;
  readonly roleId: string;
  readonly style: StyleName;
  readonly startedAt: number;
  readonly expiresAt: number;
}

/**
 * Invariant d'agrégat : au plus UN evenement actif par guilde. On ne peut demarrer que si
 * aucun n'est actif (`actif === null`). Deux events simultanes sont interdits (l'appelant
 * lit l'event actif via le store, en excluant les echus).
 */
export function peutDemarrer(actif: EvenementStyle | null): boolean {
  return actif === null;
}

/**
 * Un membre est-il une cible valide d'un event ? Regle PURE composant les trois exclusions :
 *  - bot : jamais stylise ;
 *  - non manageable : hierarchie de roles (le bot ne peut pas l'editer) -> ignore ;
 *  - opt-out : consentement refuse (issue #27) -> ignore STRICTEMENT.
 */
export function estMembreStylisable(p: {
  estBot: boolean;
  manageable: boolean;
  estOptOut: boolean;
}): boolean {
  return !p.estBot && p.manageable && !p.estOptOut;
}
