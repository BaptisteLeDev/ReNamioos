/**
 * Logique PURE du journal d'auto-rename (issue #28).
 *
 * Le journal trace les N derniers evenements d'auto-rename PAR GUILDE (succes ou
 * echec), pour que les admins puissent diagnostiquer (« pourquoi le bot ne renomme
 * pas ? ») via `/auto-rename log`, et pour DERIVER le compteur d'echecs du jour
 * expose dans /stats (`autoRenameFailuresToday`).
 *
 * Aucune dependance a discord.js ni a Neon : on ne manipule que des primitives. Le
 * ring-buffer (garder les N plus recents) et la derivation du compteur du jour sont
 * des fonctions pures, testables en memoire (cf. auto-rename-log.test.ts). L'adapter
 * (src/auto-rename-log) persiste, l'evenement (guild-member-update.ts) alimente.
 */
import type { StyleName } from "./styles";

/** Issue de l'auto-rename : applique avec succes, ou echoue (hierarchie, perm, refus). */
export type AutoRenameOutcome = "succes" | "echec";

/**
 * Une entree du journal. `detail` porte le pseudo applique (succes) ou la raison de
 * l'echec (echec) : un seul champ libre, pas de colonne par cas (minimisation D8).
 */
export interface AutoRenameLogEntry {
  guildId: string;
  memberId: string;
  style: StyleName;
  outcome: AutoRenameOutcome;
  detail: string;
  at: Date;
}

/**
 * Ring-buffer pur : renvoie les `limite` entrees les plus RECENTES (du plus recent
 * au plus ancien). Trie par `at` decroissant puis coupe. Ne mute pas l'entree.
 */
export function tronquerJournal(
  entrees: readonly AutoRenameLogEntry[],
  limite: number,
): AutoRenameLogEntry[] {
  return [...entrees].toSorted((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limite);
}

/**
 * Nombre d'ECHECS dont `at >= depuis`. Sert a deriver `autoRenameFailuresToday`
 * (depuis = minuit du fuseau du bot) sans compteur separe a maintenir.
 */
export function compterEchecsDepuis(entrees: readonly AutoRenameLogEntry[], depuis: Date): number {
  return entrees.filter((e) => e.outcome === "echec" && e.at.getTime() >= depuis.getTime()).length;
}
