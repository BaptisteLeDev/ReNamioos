/**
 * Composition du job de balayage des renommages temporaires (issue #38).
 *
 * Branche l'orchestrateur PUR `balayerEcheances` (src/jobs/sweep-temporaire) sur :
 *  - la provenance unique du pseudo d'origine + echeance (OriginalNickStore #25/#38) ;
 *  - un port `restaurer` ADAPTER Discord : resout le membre via le client et repose le
 *    pseudo memorise via le flux partage `restaurerPseudo` (anti-duplication, meme chemin
 *    que le round-trip par role et /rename).
 *
 * Le minuteur (`demarrerBalayagePeriodique`) appelle le balayage toutes les `intervalleMs`
 * et renvoie un arret propre (clearInterval) branche sur le graceful shutdown. C'est ICI que
 * Discord rencontre le job ; `sweep-temporaire.ts` reste testable sans client reel.
 */
import type { Client } from 'discord.js';
import { restaurerPseudo } from '../commands/styliser';
import type { OriginalNickStore } from '../original-nick/store';
import { balayerEcheances, type EcheanceARestaurer, type ResultatRestaurationJob } from './sweep-temporaire';

/** Intervalle de balayage par defaut : 1 minute (granularite suffisante pour des durees en h/j). */
export const INTERVALLE_BALAYAGE_MS = 60_000;

/**
 * Construit le port `restaurer` ADAPTER Discord : resout (guild, membre) puis repose le
 * pseudo memorise. Un membre/guild introuvable (parti, bot ejecte) ou une exception sont
 * traduits en echec => la ligne est CONSERVEE pour retenter (jamais de perte silencieuse).
 */
export function creerRestaurerDiscord(client: Client): (e: EcheanceARestaurer) => Promise<ResultatRestaurationJob> {
  return async (echeance) => {
    const guild = await client.guilds.fetch(echeance.guildId).catch(() => null);
    if (!guild) return { ok: false, message: 'guild introuvable' };
    const membre = await guild.members.fetch(echeance.memberId).catch(() => null);
    if (!membre) return { ok: false, message: 'membre introuvable' };
    return restaurerPseudo(membre, echeance.nick);
  };
}

/**
 * Demarre le balayage periodique des echeances. Retourne une fonction d'arret (clearInterval)
 * a brancher sur le graceful shutdown. Le balayage ne fait rien tant qu'aucune ligne n'est
 * echeancee (auto-rename par role #25 inchange).
 */
export function demarrerBalayagePeriodique(deps: {
  client: Client;
  store: OriginalNickStore;
  intervalleMs?: number;
}): () => void {
  const restaurer = creerRestaurerDiscord(deps.client);
  const intervalle = deps.intervalleMs ?? INTERVALLE_BALAYAGE_MS;
  const timer = setInterval(() => {
    void balayerEcheances({ store: deps.store, restaurer }).catch((err) =>
      console.error('[sweep-temporaire] echec du balayage periodique :', err),
    );
  }, intervalle);
  // Ne pas garder le process en vie juste pour ce timer (bun/node).
  timer.unref?.();
  return () => clearInterval(timer);
}
