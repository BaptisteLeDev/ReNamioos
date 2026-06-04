/**
 * Client Discord de ReNamioos.
 *
 * Etend le Client Discord.js avec un registre de commandes et le routage des
 * interactions. C'est l'ADAPTER cote Discord : il implemente le port StatsProvider
 * pour exposer ses metriques a l'API sans que celle-ci connaisse Discord.js.
 *
 * Le pipeline de stylisation (domaine pur) sera branche ici en B3, via les
 * commandes/events qui traduisent vers src/domain.
 */
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  type Interaction,
} from 'discord.js';
import type { Command } from './commands/types';
import { commands as registeredCommands } from './commands/index';
import type { BotStats, StatsProvider } from './api/stats-provider';
import packageJson from '../package.json' with { type: 'json' };

export class BotClient extends Client implements StatsProvider {
  public readonly commands = new Collection<string, Command>();
  private commandsToday = 0;

  constructor() {
    super({ intents: [GatewayIntentBits.Guilds] });
    for (const cmd of registeredCommands) {
      this.commands.set(cmd.data.name, cmd);
    }
    this.once(Events.ClientReady, (c) => {
      console.log(`Bot pret : connecte comme ${c.user.tag} (${c.guilds.cache.size} serveurs)`);
    });
    this.on(Events.InteractionCreate, (interaction) => {
      void this.handleInteraction(interaction);
    });
    this.on(Events.Error, (err) => console.error('Erreur client Discord :', err));
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const command = this.commands.get(interaction.commandName);
    if (!command) {
      console.error(`Commande inconnue : /${interaction.commandName}`);
      return;
    }
    try {
      this.commandsToday += 1;
      await command.execute(interaction);
    } catch (err) {
      console.error(`Erreur a l'execution de /${interaction.commandName} :`, err);
      const payload = { content: 'Une erreur est survenue.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  }

  /** Implementation du port StatsProvider (contrat /stats). */
  public getStats(): BotStats {
    return {
      guildCount: this.guilds.cache.size,
      userCount: this.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
      commandsToday: this.commandsToday,
      discordLatencyMs: this.isReady() ? Math.round(this.ws.ping) : -1,
      version: packageJson.version,
    };
  }

  public async start(token: string): Promise<void> {
    await this.login(token);
  }
}
