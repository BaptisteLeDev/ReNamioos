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
import type { GuildMember, PartialGuildMember } from "discord.js";
import {
  aPerduDernierRoleMappe,
  styleAvecConsentement,
  styleDeclenche,
} from "../domain/auto-rename";
import { appliquerRename, restaurerPseudo, sourceRename } from "../commands/styliser";
import type { StyleName } from "../domain/styles";
import type { MappingStore } from "../mapping/store";
import type { OptOutStore } from "../optout/store";
import type { AutoRenameLogStore } from "../auto-rename-log/store";
import type { OriginalNickStore } from "../original-nick/store";

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
  /**
   * Pseudo d'origine memorise (issue #25). Provenance UNIQUE pour le ROUND-TRIP : on
   * memorise le pseudo source AVANT de styliser (au gain d'un role mappe), et on le
   * RESTAURE quand le membre perd son dernier role mappe. Une ligne n'existe que tant
   * qu'un membre est stylise (minimisation D8) ; la restauration l'oublie.
   */
  originalNickStore: OriginalNickStore;
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
    const avant = roleIds(oldMember);
    const apres = roleIds(newMember);
    const declenche: StyleName | null = styleDeclenche(avant, apres, mapping);

    if (declenche === null) {
      // Aucun role mappe AJOUTE. Reste le cas du RETRAIT (round-trip #25) : si le membre
      // vient de perdre son DERNIER role mappe et qu'on a memorise son pseudo d'origine,
      // on le restaure. Sinon, rien a faire.
      if (aPerduDernierRoleMappe(avant, apres, mapping)) {
        await restaurerPseudoOrigine(newMember, deps, log);
      }
      return;
    }

    // Consentement (issue #27) : un membre opt-out n'est jamais auto-renomme. On ne lit
    // l'etat opt-out QUE si un style est declenche (pas de round-trip pour rien). Le
    // domaine pur tranche : opt-out => null, sinon le style declenche.
    const estOptOut = await deps.optOutStore.isOptOut(newMember.guild.id, newMember.id);
    const style = styleAvecConsentement(declenche, estOptOut);
    if (style === null) return; // membre opt-out : refus de consentement, rien a faire.

    // Source = pseudo serveur sinon nom global (ECART B6 #1, via sourceRename).
    const source = sourceRename(newMember, null);

    // Round-trip (issue #25) : on MEMORISE le pseudo source AVANT de styliser, pour
    // pouvoir le restaurer au retrait du dernier role mappe. Idempotent : ne pas ecraser
    // un original deja memorise lors d'une re-stylisation (le store gere l'idempotence).
    await deps.originalNickStore.rememberIfAbsent(newMember.guild.id, newMember.id, source);

    const resultat = await appliquerRename(newMember, style, source);

    // Journal (issue #28) : on trace l'issue de CETTE tentative (succes ou echec). Le
    // detail porte le pseudo applique (succes) ou le message d'echec (echec).
    await deps.logStore.record({
      guildId: newMember.guild.id,
      memberId: newMember.id,
      style,
      outcome: resultat.ok ? "succes" : "echec",
      detail: resultat.ok ? resultat.pseudo : resultat.message,
      at: new Date(),
    });

    if (!resultat.ok) {
      log.warn("echec du renommage automatique", {
        guildId: newMember.guild.id,
        memberId: newMember.id,
        style,
        raison: resultat.message,
      });
    }
  };
}

/**
 * Restaure le pseudo d'origine d'un membre (round-trip #25), appele quand il a perdu son
 * dernier role mappe. No-op si aucun pseudo n'a ete memorise (rien a restaurer). En cas de
 * succes, OUBLIE le pseudo memorise (minimisation D8). Un echec (hierarchie, permission)
 * est trace en warn STRUCTURE, comme l'aller (jamais d'exception ni de silence) ; on
 * conserve alors la memoire pour retenter plus tard.
 */
async function restaurerPseudoOrigine(
  membre: GuildMember,
  deps: DepsAutoRename,
  log: LoggerAutoRename,
): Promise<void> {
  const origine = await deps.originalNickStore.get(membre.guild.id, membre.id);
  if (origine === null) return; // jamais memorise : rien a restaurer.

  const resultat = await restaurerPseudo(membre, origine);
  if (resultat.ok) {
    await deps.originalNickStore.forget(membre.guild.id, membre.id);
  } else {
    log.warn("echec de la restauration du pseudo d origine", {
      guildId: membre.guild.id,
      memberId: membre.id,
      raison: resultat.message,
    });
  }
}
