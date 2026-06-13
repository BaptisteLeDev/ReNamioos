/**
 * Job de balayage des renommages temporaires echus (issue #38).
 *
 * Pendant « horloge » du round-trip #25 : la restauration d'un pseudo n'est plus declenchee
 * seulement par la perte du dernier role mappe (guildMemberUpdate), mais aussi par l'arrivee
 * d'une ECHEANCE. Ce job, execute periodiquement, lit les lignes echues via le store
 * (provenance unique #25/#38), demande leur restauration, puis les oublie en cas de succes.
 *
 * La DECISION « faut-il reverter maintenant » reste PURE (domaine : `estEchu`, applique par
 * `listDue` du store). Ce module n'est qu'un ORCHESTRATEUR : il ne connait pas Discord (la
 * restauration concrete est injectee via le port `restaurer`), donc il est testable sans
 * client reel. L'adapter Discord (src/jobs/index.ts) resout le membre et repose le pseudo.
 */
import type { OriginalNickStore } from '../original-nick/store';

/** Une ligne echue a restaurer (issue #38). */
export interface EcheanceARestaurer {
  guildId: string;
  memberId: string;
  nick: string;
}

/** Issue d'une restauration : succes, ou echec avec un message (pour le log). */
export type ResultatRestaurationJob = { ok: true } | { ok: false; message: string };

export interface DepsBalayage {
  /** Provenance unique du pseudo d'origine + echeance (#25/#38). */
  store: OriginalNickStore;
  /**
   * Port de restauration : resout le membre Discord et repose le pseudo memorise. Injecte
   * pour garder le job testable sans Discord. Une exception est traitee comme un echec.
   */
  restaurer: (echeance: EcheanceARestaurer) => Promise<ResultatRestaurationJob>;
  /** Horloge injectable (tests). Defaut : Date.now. */
  maintenant?: () => number;
  /** Log d'echec structure (defaut : console.warn). */
  log?: (message: string, contexte: Record<string, unknown>) => void;
}

/**
 * Restaure tous les pseudos dont l'echeance est passee. Pour chaque ligne echue : tente la
 * restauration ; en cas de succes, OUBLIE la ligne (minimisation D8) ; en cas d'echec
 * (hierarchie, permission, membre parti, exception), CONSERVE la ligne pour retenter au
 * prochain passage et trace en warn structure. Une erreur sur une ligne n'interrompt pas
 * le traitement des suivantes.
 */
export async function balayerEcheances(deps: DepsBalayage): Promise<void> {
  const maintenant = deps.maintenant ?? Date.now;
  const log = deps.log ?? ((m, c) => console.warn(`[sweep-temporaire] ${m}`, c));

  const dues = await deps.store.listDue(maintenant());
  for (const echeance of dues) {
    try {
      const resultat = await deps.restaurer(echeance);
      if (resultat.ok) {
        await deps.store.forget(echeance.guildId, echeance.memberId);
      } else {
        log('echec de la restauration temporaire (conservee)', {
          guildId: echeance.guildId,
          memberId: echeance.memberId,
          raison: resultat.message,
        });
      }
    } catch (err) {
      // Jamais de silence ni d'interruption du balayage : on trace et on passe a la suivante.
      log('exception pendant la restauration temporaire (conservee)', {
        guildId: echeance.guildId,
        memberId: echeance.memberId,
        erreur: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
