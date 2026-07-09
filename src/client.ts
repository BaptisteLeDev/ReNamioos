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
} from "discord.js";
import type { Command } from "./commands/types";
import { creerCommandes } from "./commands/index";
import { deployApplicationCommands } from "./commands/deploy-runtime";
import type { BotStats, StatsProvider } from "./api/stats-provider";
import { creerGestionnaireMembreMisAJour } from "./events/guild-member-update";
import type { MappingStore } from "./mapping/store";
import { creerFileMappingStore } from "./mapping/file-store";
import type { OptOutStore } from "./optout/store";
import { creerMemoryOptOutStore } from "./optout/memory-store";
import type { AutoRenameLogStore } from "./auto-rename-log/store";
import { creerMemoryAutoRenameLogStore } from "./auto-rename-log/memory-store";
import { CAPACITE_JOURNAL_PAR_GUILD } from "./auto-rename-log/index";
import type { OriginalNickStore } from "./original-nick/store";
import { creerMemoryOriginalNickStore } from "./original-nick/memory-store";
import type { CommandSyncStore } from "./command-sync/store";
import { creerFileCommandSyncStore, creerFileIo } from "./command-sync/file-store";
import type { CommandUsageStore } from "./command-usage/store";
import { creerMemoryCommandUsageStore } from "./command-usage/memory-store";
import packageJson from "../package.json" with { type: "json" };

export interface OptionsBotClient {
  /** Provenance UNIQUE de la config auto-rename (B8, ADR-0005). */
  mappingStore?: MappingStore;
  /** Provenance UNIQUE du consentement membre a l'auto-rename (issue #27). */
  optOutStore?: OptOutStore;
  /** Provenance UNIQUE du journal d'auto-rename (issue #28). Defaut : memoire (dev). */
  autoRenameLogStore?: AutoRenameLogStore;
  /** Provenance UNIQUE du pseudo d'origine pour le round-trip (issue #25). Defaut : memoire. */
  originalNickStore?: OriginalNickStore;
  /** Provenance des commandes connues par serveur (/update). Defaut : fichier dev. */
  commandSyncStore?: CommandSyncStore;
  /** Provenance UNIQUE du suivi d'usage des commandes (issue #27). Defaut : memoire (dev). */
  commandUsageStore?: CommandUsageStore;
  /**
   * Identifiants Discord pour le PUT REST de /update (re-synchro par serveur) ET pour
   * l'auto-deploiement au demarrage (#40). Absents (defaut en test) => /update repond
   * une erreur propre et l'auto-deploiement est inerte.
   */
  discord?: {
    applicationId: string;
    token: string;
    /** Si defini : deploiement guild-only (dev, instantane). Sinon : global (prod). */
    guildId?: string | undefined;
    /** Auto-deploiement des slash au demarrage (#40). Defaut implicite false si absent. */
    autoDeployCommands?: boolean | undefined;
  };
}

export class BotClient extends Client implements StatsProvider {
  public readonly commands = new Collection<string, Command>();
  private commandsToday = 0;
  /** Source du compteur d'echecs d'auto-rename du jour expose dans /stats (issue #28). */
  private readonly autoRenameLogStore: AutoRenameLogStore;
  /** Source de la serie commandsDaily (30j) exposee dans /stats (issue #27). */
  private readonly commandUsageStore: CommandUsageStore;
  /** Identifiants Discord (auto-deploiement #40 + /update). Absents en test. */
  private readonly discord: OptionsBotClient["discord"];
  /** Client REST partage par /update et l'auto-deploiement (#40). Absent sans `discord`. */
  private readonly restClient: REST | undefined;

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
    const optOutStore = options.optOutStore ?? creerMemoryOptOutStore();
    const autoRenameLogStore =
      options.autoRenameLogStore ??
      creerMemoryAutoRenameLogStore({ capaciteParGuild: CAPACITE_JOURNAL_PAR_GUILD });
    this.autoRenameLogStore = autoRenameLogStore;
    const originalNickStore = options.originalNickStore ?? creerMemoryOriginalNickStore();
    const commandSyncStore =
      options.commandSyncStore ?? creerFileCommandSyncStore(creerFileIo("command-sync.json"));
    this.commandUsageStore = options.commandUsageStore ?? creerMemoryCommandUsageStore();
    this.discord = options.discord;
    this.restClient = options.discord
      ? new REST({ version: "10" }).setToken(options.discord.token)
      : undefined;
    const redeploy = this.construireRedeploy(options.discord);

    for (const cmd of creerCommandes({
      mappingStore,
      optOutStore,
      autoRenameLogStore,
      commandSyncStore,
      originalNickStore,
      redeploy,
    })) {
      this.commands.set(cmd.data.name, cmd);
    }
    // Auto-rename (B8, ADR-0005) : abonnement a guildMemberUpdate. L'evenement
    // n'arrive que si l'intent privilegie GuildMembers est active (Dev Portal).
    // Le consentement membre (issue #27) est consulte avant tout rename via optOutStore ;
    // chaque tentative est journalisee (issue #28) via autoRenameLogStore.
    const onMembreMisAJour = creerGestionnaireMembreMisAJour({
      store: mappingStore,
      optOutStore,
      logStore: autoRenameLogStore,
      originalNickStore,
    });
    this.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
      void onMembreMisAJour(oldMember, newMember);
    });
    this.once(Events.ClientReady, (c) => {
      console.log(`Bot pret : connecte comme ${c.user.tag} (${c.guilds.cache.size} serveurs)`);
      void this.deployerAuDemarrage(c);
    });
    this.on(Events.InteractionCreate, (interaction) => {
      void this.handleInteraction(interaction);
    });
    this.on(Events.Error, (err) => console.error("Erreur client Discord :", err));
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
      // Suivi d'usage par jour (issue #27) : alimente la serie commandsDaily de /stats.
      // Tir-and-forget : ne bloque pas l'execution de la commande, ne la fait pas echouer
      // si la persistance Neon a un souci (le cache memoire a deja ete incremente).
      void this.commandUsageStore
        .record()
        .catch((err) => console.error("Echec persistance suivi usage commande :", err));
      await command.execute(interaction);
    } catch (err) {
      console.error(`Erreur a l'execution de /${interaction.commandName} :`, err);
      const payload = { content: "Une erreur est survenue.", ephemeral: true };
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
    discord: OptionsBotClient["discord"],
  ): (guildId: string, payload: RESTPostAPIApplicationCommandsJSONBody[]) => Promise<void> {
    if (!discord || !this.restClient) {
      return () =>
        Promise.reject(new Error("Re-deploiement indisponible : identifiants Discord absents."));
    }
    const rest = this.restClient;
    return async (guildId, payload) => {
      await rest.put(Routes.applicationGuildCommands(discord.applicationId, guildId), {
        body: payload,
      });
    };
  }

  /**
   * Auto-deploiement des slash-commands au demarrage (#40). Reutilise la logique
   * partagee `deployApplicationCommands` (scope global/guild + purge des doublons).
   * Inerte sans identifiants Discord ou si autoDeployCommands est false. Non bloquant :
   * un echec de deploiement est logge mais ne fait pas tomber le bot.
   */
  private async deployerAuDemarrage(client: Client<true>): Promise<void> {
    if (!this.discord || !this.restClient || !this.discord.autoDeployCommands) {
      return;
    }
    try {
      await deployApplicationCommands({
        rest: this.restClient,
        applicationId: this.discord.applicationId,
        guildId: this.discord.guildId,
        payload: this.commands.map((c) => c.data.toJSON()),
        guildIds: [...client.guilds.cache.keys()],
        log: { info: (m) => console.log(m), warn: (m) => console.warn(m) },
      });
    } catch (err) {
      console.error("Echec du deploiement des commandes au demarrage (non bloquant) :", err);
    }
  }

  /** Implementation du port StatsProvider (contrat /stats). */
  public getStats(): BotStats {
    return {
      guildCount: this.guilds.cache.size,
      userCount: this.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
      commandsToday: this.commandsToday,
      autoRenameFailuresToday: this.autoRenameLogStore.failuresToday(),
      commandsDaily: this.commandUsageStore.commandsDaily(),
      discordLatencyMs: this.isReady() ? Math.round(this.ws.ping) : -1,
      version: packageJson.version,
    };
  }

  public async start(token: string): Promise<void> {
    await this.login(token);
  }
}
