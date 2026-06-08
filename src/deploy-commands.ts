/**
 * Deploiement des commandes slash sur Discord.
 *
 * Si DISCORD_GUILD_ID est defini : deploiement sur cette guild (instantane, dev).
 * Sinon : deploiement global (propagation jusqu'a 1h).
 *
 *   bun run deploy-commands
 */
import { REST, Routes } from 'discord.js';
import { loadConfig } from './config';
import { creerCommandes } from './commands/index';
import { creerFileMappingStore } from './mapping/file-store';
import { creerFileCommandSyncStore, creerFileIo } from './command-sync/file-store';

async function deploy(): Promise<void> {
  const config = loadConfig();
  // Les stores et le redeploy n'influent pas sur le SCHEMA des slash (ils n'alimentent
  // que l'execution) -> stores fichier vides + redeploy no-op ici, suffisant pour
  // produire le schema a deployer (aucune connexion Neon necessaire).
  const body = creerCommandes({
    mappingStore: creerFileMappingStore({}),
    commandSyncStore: creerFileCommandSyncStore(creerFileIo('command-sync.json')),
    redeploy: () => Promise.resolve(),
  }).map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  if (config.discord.guildId) {
    console.log(`Deploiement de ${body.length} commande(s) sur la guild ${config.discord.guildId}`);
    await rest.put(
      Routes.applicationGuildCommands(config.discord.applicationId, config.discord.guildId),
      { body },
    );
  } else {
    console.log(`Deploiement global de ${body.length} commande(s) (jusqu'a 1h de propagation)`);
    await rest.put(Routes.applicationCommands(config.discord.applicationId), { body });
  }
  console.log('Commandes deployees.');
}

void deploy();
