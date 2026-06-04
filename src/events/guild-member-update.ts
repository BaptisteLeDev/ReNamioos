/**
 * Adapter Discord de l'auto-rename (B6, cf. decisions/0004-auto-rename.md).
 *
 * TRADUIT l'evenement `guildMemberUpdate` vers le domaine PUR
 * (src/domain/auto-rename) puis applique via le flux PARTAGE `appliquerRename`
 * (src/commands/styliser) — anti-duplication : meme chemin que /rename et /random
 * (verif hierarchie, stylisation domaine, troncature 32 code points, edit du nick).
 *
 * C'est ici, et nulle part dans le domaine, que le modele Discord (GuildMember,
 * Role) rencontre la logique : on extrait les identifiants de roles (string) et le
 * nom source, on appelle le domaine, on repose le resultat. Invariant ACL ciblee
 * (ADR-0002) : aucun objet Discord ne fuit dans src/domain.
 *
 * ECARTS VOLONTAIRES B6 (vs comportement pinne, docs/caracterisation.md) :
 *  - SOURCE = pseudo SERVEUR (nickname) s'il existe, sinon nom global (bug n°6) —
 *    delegue a `sourceRename(membre, null)`.
 *  - DETECTION = diff d'ENSEMBLES de roles (bug n°7) — delegue a `styleDeclenche`.
 *
 * Gestion d'erreurs : tout echec (hierarchie, permission Discord, refus propre du
 * domaine) est trace en `warn` STRUCTURE avec {guildId, memberId, style}. Jamais
 * d'exception remontee, jamais de silence (mandat : aucun catch silencieux).
 */
import type { GuildMember, PartialGuildMember } from 'discord.js';
import { styleDeclenche, type MappingRoleStyle } from '../domain/auto-rename';
import { appliquerRename, sourceRename } from '../commands/styliser';
import type { StyleName } from '../domain/styles';

/** Seam de log structure : injectable pour les tests, console.warn par defaut. */
export interface LoggerAutoRename {
  warn: (message: string, contexte: Record<string, unknown>) => void;
}

const loggerParDefaut: LoggerAutoRename = {
  warn: (message, contexte) => console.warn(`[auto-rename] ${message}`, contexte),
};

export interface DepsAutoRename {
  mapping: MappingRoleStyle;
  log?: LoggerAutoRename;
}

/** Liste ordonnee des identifiants de roles d'un membre (frontiere Discord -> domaine). */
function roleIds(membre: GuildMember | PartialGuildMember): string[] {
  return [...membre.roles.cache.keys()];
}

/**
 * Cree le handler `guildMemberUpdate`. La config (mapping) et le logger sont
 * injectes a la composition (src/client.ts) ; le handler reste une fermeture pure
 * de dependances explicites — testable sans Discord reel.
 */
export function creerGestionnaireMembreMisAJour(deps: DepsAutoRename) {
  const log = deps.log ?? loggerParDefaut;

  return async function onGuildMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ): Promise<void> {
    const style: StyleName | null = styleDeclenche(
      roleIds(oldMember),
      roleIds(newMember),
      deps.mapping,
    );
    if (style === null) return; // aucun role mappe ajoute : rien a faire.

    // Source = pseudo serveur sinon nom global (ECART B6 #1, via sourceRename).
    const source = sourceRename(newMember, null);
    const resultat = await appliquerRename(newMember, style, source);

    if (!resultat.ok) {
      log.warn('echec du renommage automatique', {
        guildId: newMember.guild.id,
        memberId: newMember.id,
        style,
        raison: resultat.message,
      });
    }
  };
}
