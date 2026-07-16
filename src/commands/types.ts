/**
 * Type d'une commande slash : un descripteur (schema) + un handler d'execution.
 *
 * Les commandes sont des ADAPTERS Discord : elles traduisent une interaction vers
 * le domaine pur (B3) et reposent le resultat. Elles ne portent pas de logique
 * metier elles-memes.
 */
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  UserContextMenuCommandInteraction,
} from "discord.js";

export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface Command {
  data: CommandData;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  /** Optionnel : autocompletion d'une option (ex. choix du style avec apercu). */
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

/**
 * Interaction de menu contextuel (clic droit -> Apps), sur un MESSAGE ou un MEMBRE. Type
 * DISTINCT de {@link Command} (slash) : le registre et le routage (client.ts) les separent,
 * et le deploiement inclut les deux. On ne fusionne pas les `execute` (interactions de types
 * differents) : l'ouvert/ferme est mieux servi par deux contrats etroits.
 */
export interface CommandContextuelle {
  data: ContextMenuCommandBuilder;
  execute(
    interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction,
  ): Promise<void>;
}

/**
 * Gestionnaire d'interaction de COMPOSANT (select menu, bouton), route par PREFIXE de
 * customId (stateless, restart-safe : aucun collecteur en memoire). Le routeur (client.ts)
 * choisit le gestionnaire dont le `prefixe` correspond au debut du customId, puis delegue.
 */
export interface GestionnaireComposant {
  /** Prefixe de customId possede (partie avant le premier ':'). Unique par gestionnaire. */
  readonly prefixe: string;
  execute(interaction: MessageComponentInteraction): Promise<void>;
}
