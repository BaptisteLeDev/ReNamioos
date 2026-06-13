/**
 * Logique PARTAGEE de deploiement des slash-commands (#40).
 *
 * Utilisee a la fois par le demarrage du bot (`ClientReady`, src/client.ts) et par le
 * script manuel `deploy-commands` (src/deploy-commands.ts) : une seule source de verite
 * pour le CHOIX du scope (global vs guild) et la PURGE des doublons (regle de 3).
 *
 * Politique (miroir de Moodioos, issue #16) :
 *   - DEV (DISCORD_GUILD_ID defini) : deploiement guild-only, propagation instantanee.
 *   - PROD (pas de DISCORD_GUILD_ID) : la portee GLOBALE est l'unique source des
 *     commandes. On n'enregistre JAMAIS par guilde (sinon Discord affiche global +
 *     guilde = doublons). On emet seulement un PUT `[]` par guilde connue pour PURGER
 *     d'eventuels doublons deja enregistres.
 *
 * Le client REST est INJECTE (port `RestPutClient`) : la logique est testable sans
 * reseau Discord.
 */
import { Routes } from 'discord.js';

/** Port minimal sur le client REST de discord.js (`rest.put`). */
export interface RestPutClient {
  put(route: string, options?: { body?: unknown }): Promise<unknown>;
}

export interface DeployArgs {
  rest: RestPutClient;
  applicationId: string;
  /** Si defini -> mode DEV guild-only. Sinon -> mode PROD global. */
  guildId: string | undefined;
  payload: unknown[];
  /** IDs des guildes en cache (utilises uniquement pour la purge en prod). */
  guildIds: string[];
  /** Logger (console par defaut) : permet d'observer/silencer en test. */
  log?: { info(msg: string): void; warn(msg: string): void };
}

const noopLog = { info: () => {}, warn: () => {} };

/**
 * Deploie les commandes selon le mode (dev/prod) et purge les doublons de guilde en
 * production. Idempotent cote Discord (PUT remplace l'ensemble).
 */
export async function deployApplicationCommands(args: DeployArgs): Promise<void> {
  const { rest, applicationId, guildId, payload, guildIds, log = noopLog } = args;

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: payload });
    log.info(`Deploiement guild-only (dev) : ${payload.length} commande(s) sur ${guildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(applicationId), { body: payload });
  log.info(`Deploiement global : ${payload.length} commande(s) (jusqu'a 1h de propagation)`);

  await purgerCommandesGuildes(rest, applicationId, guildIds, log);
}

/**
 * Purge les commandes de portee guilde sur chaque guilde connue (PUT `[]`), pour
 * eliminer d'eventuels doublons. Tolerant aux echecs par guilde (une guilde
 * inaccessible ne bloque pas les autres).
 */
async function purgerCommandesGuildes(
  rest: RestPutClient,
  applicationId: string,
  guildIds: string[],
  log: NonNullable<DeployArgs['log']>,
): Promise<void> {
  if (guildIds.length === 0) {
    return;
  }
  const concurrence = 5;
  let ok = 0;
  let echecs = 0;
  for (let i = 0; i < guildIds.length; i += concurrence) {
    const lot = guildIds.slice(i, i + concurrence);
    const resultats = await Promise.allSettled(
      lot.map((gid) =>
        rest.put(Routes.applicationGuildCommands(applicationId, gid), { body: [] }),
      ),
    );
    for (const [idx, r] of resultats.entries()) {
      if (r.status === 'fulfilled') {
        ok += 1;
      } else {
        echecs += 1;
        log.warn(`Purge guild ${lot[idx]} echouee : ${String(r.reason)}`);
      }
    }
  }
  log.info(`Purge des doublons de guilde terminee : ${ok} ok, ${echecs} echec(s) / ${guildIds.length}`);
}
