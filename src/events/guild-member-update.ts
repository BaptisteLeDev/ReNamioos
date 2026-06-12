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
import { styleAvecConsentement, styleDeclenche } from '../domain/auto-rename';
import { appliquerRename, sourceRename } from '../commands/styliser';
import type { StyleName } from '../domain/styles';
import type { MappingStore } from '../mapping/store';
import type { OptOutStore } from '../optout/store';
import type { AutoRenameLogStore } from '../auto-rename-log/store';

/** Seam de log structure : injectable pour les tests, console.warn par defaut. */
export interface LoggerAutoRename {
  warn: (message: string, contexte: Record<string, unknown>) => void;
}

const loggerParDefaut: LoggerAutoRename = {
  warn: (message, contexte) => console.warn(`[auto-rename] ${message}`, contexte),
};

export interface DepsAutoRename {
  /**
   * Provenance UNIQUE rOle -> style (B8, ADR-0005). Interroge PAR GUILD : la config
   * est par serveur. Le store porte le cache (NeonMappingStore) ; l'adapter ne fait
   * que lire le mapping ordonne de la guild et le donner au domaine pur.
   */
  store: MappingStore;
  /**
   * Consentement membre (issue #27). Provenance UNIQUE de l'etat opt-out PAR SERVEUR.
   * Consulte AVANT d'appliquer un rename declenche : un membre opt-out n'est jamais
   * renomme automatiquement, quel que soit le style declenche par ses roles.
   */
  optOutStore: OptOutStore;
  /**
   * Journal d'auto-rename (issue #28). On y enregistre CHAQUE tentative effective
   * (succes ou echec) pour le diagnostic admin (`/auto-rename log`) et la derivation
   * du compteur d'echecs du jour de /stats. Les non-evenements (aucun role mappe gagne,
   * membre opt-out) ne sont PAS journalises : ce ne sont pas des tentatives.
   */
  logStore: AutoRenameLogStore;
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
    // Provenance par serveur : on lit le mapping ORDONNE de cette guild (cache cOte
    // store). Le domaine pur tranche le style a appliquer (priorite = ordre).
    const mapping = await deps.store.list(newMember.guild.id);
    const declenche: StyleName | null = styleDeclenche(
      roleIds(oldMember),
      roleIds(newMember),
      mapping,
    );
    if (declenche === null) return; // aucun role mappe ajoute : rien a faire.

    // Consentement (issue #27) : un membre opt-out n'est jamais auto-renomme. On ne lit
    // l'etat opt-out QUE si un style est declenche (pas de round-trip pour rien). Le
    // domaine pur tranche : opt-out => null, sinon le style declenche.
    const estOptOut = await deps.optOutStore.isOptOut(newMember.guild.id, newMember.id);
    const style = styleAvecConsentement(declenche, estOptOut);
    if (style === null) return; // membre opt-out : refus de consentement, rien a faire.

    // Source = pseudo serveur sinon nom global (ECART B6 #1, via sourceRename).
    const source = sourceRename(newMember, null);
    const resultat = await appliquerRename(newMember, style, source);

    // Journal (issue #28) : on trace l'issue de CETTE tentative (succes ou echec). Le
    // detail porte le pseudo applique (succes) ou le message d'echec (echec).
    await deps.logStore.record({
      guildId: newMember.guild.id,
      memberId: newMember.id,
      style,
      outcome: resultat.ok ? 'succes' : 'echec',
      detail: resultat.ok ? resultat.pseudo : resultat.message,
      at: new Date(),
    });

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
