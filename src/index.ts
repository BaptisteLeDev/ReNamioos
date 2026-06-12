/**
 * Point d'entree — bootstrap.
 *
 * Ordre STRICT (standard de la flotte, bots/_standards/) :
 *   1. Demarrer l'API HTTP EN PREMIER (health/monitoring dispo meme si le bot rate).
 *   2. Demarrer le bot Discord ENSUITE.
 *
 * L'echec du login Discord NE DOIT PAS empecher l'API de servir /health et /stats
 * (le contrat exige une preuve de vie independante de l'etat de connexion Discord).
 */
import { loadConfig } from './config';
import { chargerConfigAutoRename } from './config/auto-rename-config';
import { createApiServer } from './api/server';
import { BotClient } from './client';
import { creerMappingStore } from './mapping/index';
import { creerOptOutStore } from './optout/index';
import { creerCommandSyncStore } from './command-sync/index';
import { closeDb } from './db/client';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  console.log(`Demarrage de ReNamioos (env: ${config.env})`);

  // Provenance de la config auto-rename (B8, ADR-0005). Le FICHIER auto-rename.json
  // est toujours charge+valide au boot (echec fort si un style est inconnu) : il sert
  // de fallback lecture en mode Neon, et de source unique en mode dev (sans DATABASE_URL).
  const mappingFichier = chargerConfigAutoRename(config.autoRenameConfigPath);
  const mappingStore = creerMappingStore({
    databaseUrl: config.database.url,
    mappingFichier,
  });
  console.log(
    config.database.url
      ? `Auto-rename : mode Neon (par serveur), fallback fichier ${Object.keys(mappingFichier).length} role(s)`
      : `Auto-rename : mode fichier (dev), ${Object.keys(mappingFichier).length} role(s) mappe(s)`,
  );

  // Provenance du consentement membre a l'auto-rename (issue #27) : Neon en prod (par
  // serveur, persistant), memoire en dev (ephemere). Une ligne n'existe que pour un
  // membre opt-out (minimisation D8).
  const optOutStore = creerOptOutStore({ databaseUrl: config.database.url });

  // Provenance des commandes connues par serveur (/update) : Neon en prod, JSON local en dev.
  const commandSyncStore = creerCommandSyncStore({ databaseUrl: config.database.url });

  const bot = new BotClient({
    mappingStore,
    optOutStore,
    commandSyncStore,
    discord: {
      applicationId: config.discord.applicationId,
      token: config.discord.token,
    },
  });

  // 1. API d'abord.
  const api = await createApiServer({
    statsProvider: bot,
    logger: config.isDevelopment,
    statsToken: config.api.statsToken,
    corsOrigins: config.api.corsOrigins,
    rateLimit: config.api.rateLimit,
  });
  await api.listen({ port: config.api.port, host: config.api.host });
  console.log(`API a l'ecoute sur http://${config.api.host}:${config.api.port}`);

  // 2. Bot ensuite. Un echec de login ne fait pas tomber l'API.
  try {
    await bot.start(config.discord.token);
  } catch (err) {
    console.error('Echec du login Discord (l\'API reste disponible) :', err);
  }

  setupGracefulShutdown(async () => {
    await bot.destroy();
    await api.close();
    await closeDb(); // ferme le pool Postgres (no-op en mode fichier).
  });
}

function setupGracefulShutdown(cleanup: () => Promise<void>): void {
  const shutdown = (signal: string): void => {
    console.log(`Signal ${signal} recu, arret propre...`);
    cleanup()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('Erreur a l\'arret :', err);
        process.exit(1);
      });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void bootstrap();
