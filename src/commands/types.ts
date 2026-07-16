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
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
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
