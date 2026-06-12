/**
 * Port (au sens hexagonal) entre l'API HTTP et la source des metriques metier.
 *
 * L'API ne connait PAS Discord.js : elle depend de ce contrat. L'adapter concret
 * (le BotClient, cote Discord) l'implemente. Cela permet de tester le contrat
 * /stats sans connexion Discord (cf. contract.test.ts) et garde l'invariant
 * "/health repond vite et sans I/O lourde".
 *
 * Les noms de champs suivent le contrat publie (monitoring/docs/contrat-cibles.md) :
 * guildCount / userCount (PAS guilds / users).
 */
export interface BotStats {
  /** Serveurs Discord ou le bot est present. */
  guildCount: number;
  /** Utilisateurs couverts (membres caches cumules). */
  userCount: number;
  /** Commandes executees depuis minuit (fuseau du bot). */
  commandsToday: number;
  /** Echecs d'auto-rename depuis minuit (issue #28) : derive du journal, compteur memoire. */
  autoRenameFailuresToday: number;
  /** Latence WebSocket vers Discord en ms (-1 si non connecte). */
  discordLatencyMs: number;
  /** Version deployee du bot. */
  version: string;
}

export interface StatsProvider {
  /** Renvoie un instantane des metriques metier. Ne doit jamais lever. */
  getStats(): BotStats;
}
