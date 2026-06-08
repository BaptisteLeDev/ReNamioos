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
  REST,
  Routes,
  type Interaction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import type { Command } from './commands/types';
import { creerCommandes } from './commands/index';
import type { BotStats, StatsProvider } from './api/stats-provider';
import { creerGestionnaireMembreMisAJour } from './events/guild-member-update';
import type { MappingStore } from './mapping/store';
import { creerFileMappingStore } from './mapping/file-store';
import type { CommandSyncStore } from './command-sync/store';
import { creerFileCommandSyncStore, creerFileIo } from './command-sync/file-store';
import packageJson from '../package.json' with { type: 'json' };

export interface OptionsBotClient {
  /** Provenance UNIQUE de la config auto-rename (B8, ADR-0005). */
  mappingStore?: MappingStore;
  /** Provenance des commandes connues par serveur (/update). Defaut : fichier dev. */
  commandSyncStore?: CommandSyncStore;
  /**
   * Identifiants Discord pour le PUT REST de /update (re-synchro par serveur). Absents
   * (defaut en test) => /update repond une erreur propre au lieu de re-deployer.
   */
  discord?: { applicationId: string; token: string };
}

export class BotClient extends Client implements StatsProvider {
  public readonly commands = new Collection<string, Command>();
  private commandsToday = 0;

  /**
   * @param options injection de la composition (src/index.ts). Tous les champs sont
   *   optionnels : sans argument, le bot demarre avec des stores fichier vides
   *   (auto-rename inactif) et /update non operationnel (utile en test/typecheck).
   *   L'intent GuildMembers (PRIVILEGIE) est requis pour guildMemberUpdate (auto-rename).
   */
  constructor(options: OptionsBotClient = {}) {
    // GuildMembers est un intent PRIVILEGIE (a activer dans le Dev Portal) : sans
    // lui, guildMemberUpdate n'arrive jamais. On le demande car l'auto-rename en
    // depend ; les autres intents restent minimaux (cf. ARCHITECTURE.md).
    super({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

    const mappingStore = options.mappingStore ?? creerFileMappingStore({});
    const commandSyncStore =
      options.commandSyncStore ?? creerFileCommandSyncStore(creerFileIo('command-sync.json'));
    const redeploy = this.construireRedeploy(options.discord);

    for (const cmd of creerCommandes({ mappingStore, commandSyncStore, redeploy })) {
      this.commands.set(cmd.data.name, cmd);
    }
    // Auto-rename (B8, ADR-0005) : abonnement a guildMemberUpdate. L'evenement
    // n'arrive que si l'intent privilegie GuildMembers est active (Dev Portal).
    const onMembreMisAJour = creerGestionnaireMembreMisAJour({ store: mappingStore });
    this.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
      void onMembreMisAJour(oldMember, newMember);
    });
    this.once(Events.ClientReady, (c) => {
      console.log(`Bot pret : connecte comme ${c.user.tag} (${c.guilds.cache.size} serveurs)`);
    });
    this.on(Events.InteractionCreate, (interaction) => {
      void this.handleInteraction(interaction);
    });
    this.on(Events.Error, (err) => console.error('Erreur client Discord :', err));
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isAutocomplete()) {
      const cmd = this.commands.get(interaction.commandName);
      if (cmd?.autocomplete) {
        try {
          await cmd.autocomplete(interaction);
        } catch (err) {
          console.error(`Erreur autocomplete /${interaction.commandName} :`, err);
        }
      }
      return;
    }
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

  /**
   * Construit la fonction de re-deploiement REST utilisee par /update. Sans
   * identifiants Discord (test), renvoie une fonction qui echoue proprement :
   * /update repondra alors son message d'erreur ephemere standard.
   */
  private construireRedeploy(
    discord: OptionsBotClient['discord'],
  ): (guildId: string, payload: RESTPostAPIApplicationCommandsJSONBody[]) => Promise<void> {
    if (!discord) {
      return () =>
        Promise.reject(new Error('Re-deploiement indisponible : identifiants Discord absents.'));
    }
    const rest = new REST({ version: '10' }).setToken(discord.token);
    return async (guildId, payload) => {
      await rest.put(Routes.applicationGuildCommands(discord.applicationId, guildId), {
        body: payload,
      });
    };
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
