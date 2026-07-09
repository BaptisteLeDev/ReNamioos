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
import { loadConfig } from "./config";
import { chargerConfigAutoRename } from "./config/auto-rename-config";
import { createApiServer } from "./api/server";
import { BotClient } from "./client";
import { creerMappingStore } from "./mapping/index";
import { creerOptOutStore } from "./optout/index";
import { creerAutoRenameLogStore } from "./auto-rename-log/index";
import { creerOriginalNickStore } from "./original-nick/index";
import { creerCommandSyncStore } from "./command-sync/index";
import { creerCommandUsageStore } from "./command-usage/index";
import { demarrerBalayagePeriodique } from "./jobs/index";
import { closeDb } from "./db/client";
import { runMigrations } from "./db/migrate";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  console.log(`Demarrage de ReNamioos (env: ${config.env})`);

  // Auto-migrate au boot (B8, ADR-0005), AVANT de servir l'API et de connecter Discord :
  // un schema desynchronise est non recuperable. Sans DATABASE_URL (mode fichier) => saute.
  // Echec en mode Neon => FATAL (relance non catchee => bootstrap log + exit non-zero).
  await runMigrations(config.database.url);

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

  // Provenance du journal d'auto-rename (issue #28) : ring-buffer Neon en prod (borne par
  // guilde), memoire en dev. Alimente le diagnostic /auto-rename log et la metrique
  // autoRenameFailuresToday de /stats.
  const autoRenameLogStore = creerAutoRenameLogStore({ databaseUrl: config.database.url });

  // Provenance du pseudo d'origine (issue #25) pour le round-trip : on memorise le pseudo
  // source au rename, on le restaure au retrait du dernier role mappe. Neon en prod (par
  // serveur), memoire en dev. Une ligne n'existe que tant qu'un membre est stylise (D8).
  const originalNickStore = creerOriginalNickStore({ databaseUrl: config.database.url });

  // Provenance des commandes connues par serveur (/update) : Neon en prod, JSON local en dev.
  const commandSyncStore = creerCommandSyncStore({ databaseUrl: config.database.url });

  // Provenance du suivi d'usage des commandes (issue #27) : compteur par jour persiste en
  // Neon (prod), memoire en dev. Alimente la serie commandsDaily (30j) de /stats. On hydrate
  // le cache memoire au boot pour que /stats reflete l'historique sans round-trip ensuite.
  const commandUsageStore = creerCommandUsageStore({ databaseUrl: config.database.url });
  await commandUsageStore.load();

  const bot = new BotClient({
    mappingStore,
    optOutStore,
    autoRenameLogStore,
    originalNickStore,
    commandSyncStore,
    commandUsageStore,
    discord: {
      applicationId: config.discord.applicationId,
      token: config.discord.token,
      guildId: config.discord.guildId,
      autoDeployCommands: config.discord.autoDeployCommands,
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
  let arreterBalayage: () => void = () => {};
  try {
    await bot.start(config.discord.token);
    // Balayage periodique des renommages temporaires echus (issue #38) : restaure les
    // pseudos dont l'echeance est passee. Demarre apres login (a besoin du client connecte).
    arreterBalayage = demarrerBalayagePeriodique({ client: bot, store: originalNickStore });
  } catch (err) {
    console.error("Echec du login Discord (l'API reste disponible) :", err);
  }

  setupGracefulShutdown(async () => {
    arreterBalayage();
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
        console.error("Erreur a l'arret :", err);
        process.exit(1);
      });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void bootstrap();
