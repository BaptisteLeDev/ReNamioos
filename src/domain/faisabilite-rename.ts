/**
 * Predicat PUR : le bot pourra-t-il renommer les membres d'un role ? (#29)
 *
 * Memes controles que `appliquerRename` (src/commands/styliser.ts), mais evalues
 * PAR ANTICIPATION au moment ou un admin mappe le role (/auto-rename add). Sert a
 * PREVENIR (sans bloquer) : un mapping reste enregistre meme si le bot ne pourra
 * pas l'appliquer aujourd'hui (la hierarchie ou la permission peut changer ensuite).
 *
 * Aucun import discord.js : l'adapter extrait les primitives (permission, positions
 * de role) et nous les passe. Etats invalides irrepresentables via un Result.
 */

/** Pourquoi le bot ne pourra pas renommer (union fermee). */
export type RaisonInfaisabilite = 'permission-manquante' | 'role-trop-haut';

export type FaisabiliteRename =
  | { ok: true }
  | { ok: false; raison: RaisonInfaisabilite };

export interface ContexteFaisabilite {
  /** Le bot a-t-il la permission Manage Nicknames sur la guild ? */
  botPeutGererPseudos: boolean;
  /** Position du role le plus haut du bot (hierarchie Discord ; plus haut = plus grand). */
  positionRoleBot: number;
  /** Position du role cible du mapping. */
  positionRoleCible: number;
}

/**
 * La permission prime : sans Manage Nicknames, aucun rename n'est possible quelle
 * que soit la hierarchie. Ensuite, le role du bot doit etre STRICTEMENT au-dessus
 * du role cible (a egalite, Discord refuse l'edition).
 */
export function evaluerFaisabiliteRename(ctx: ContexteFaisabilite): FaisabiliteRename {
  if (!ctx.botPeutGererPseudos) return { ok: false, raison: 'permission-manquante' };
  if (ctx.positionRoleBot <= ctx.positionRoleCible) return { ok: false, raison: 'role-trop-haut' };
  return { ok: true };
}
