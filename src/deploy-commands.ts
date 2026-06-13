/**
 * Deploiement des commandes slash sur Discord.
 *
 * Si DISCORD_GUILD_ID est defini : deploiement sur cette guild (instantane, dev).
 * Sinon : deploiement global (propagation jusqu'a 1h).
 *
 *   bun run deploy-commands
 */
import { REST } from 'discord.js';
import { loadConfig } from './config';
import { creerCommandes } from './commands/index';
import { deployApplicationCommands } from './commands/deploy-runtime';
import { creerFileMappingStore } from './mapping/file-store';
import { creerMemoryOptOutStore } from './optout/memory-store';
import { creerMemoryAutoRenameLogStore } from './auto-rename-log/memory-store';
import { CAPACITE_JOURNAL_PAR_GUILD } from './auto-rename-log/index';
import { creerFileCommandSyncStore, creerFileIo } from './command-sync/file-store';
import { creerMemoryOriginalNickStore } from './original-nick/memory-store';

async function deploy(): Promise<void> {
  const config = loadConfig();
  // Les stores et le redeploy n'influent pas sur le SCHEMA des slash (ils n'alimentent
  // que l'execution) -> stores fichier vides + redeploy no-op ici, suffisant pour
  // produire le schema a deployer (aucune connexion Neon necessaire).
  const body = creerCommandes({
    mappingStore: creerFileMappingStore({}),
    optOutStore: creerMemoryOptOutStore(),
    autoRenameLogStore: creerMemoryAutoRenameLogStore({
      capaciteParGuild: CAPACITE_JOURNAL_PAR_GUILD,
    }),
    commandSyncStore: creerFileCommandSyncStore(creerFileIo('command-sync.json')),
    originalNickStore: creerMemoryOriginalNickStore(),
    redeploy: () => Promise.resolve(),
  }).map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  // Reutilise la logique partagee de choix du scope + purge (regle de 3, #40). Le
  // script manuel n'a pas de cache de guildes connecte -> purge no-op (guildIds vide).
  await deployApplicationCommands({
    rest,
    applicationId: config.discord.applicationId,
    guildId: config.discord.guildId,
    payload: body,
    guildIds: [],
    log: { info: (m) => console.log(m), warn: (m) => console.warn(m) },
  });
  console.log('Commandes deployees.');
}

void deploy();
