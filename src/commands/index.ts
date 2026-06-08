/**
 * Registre des commandes slash. Toute nouvelle commande s'ajoute ici.
 *
 * Fabrique : la plupart des commandes sont des objets statiques, mais /aide et
 * /auto-rename dependent de la PROVENANCE de la config auto-rename. Depuis B8
 * (ADR-0005) celle-ci est le port MappingStore (Neon par serveur, ou fichier en
 * dev), injecte a la composition (src/client.ts). On expose donc une fabrique qui
 * recoit le store ; le deploiement des slash (deploy-commands.ts) passe un store
 * fichier vide (suffisant pour produire le SCHEMA des commandes).
 *
 * /update (admin) re-synchronise les commandes sur le serveur courant et detecte les
 * nouvelles depuis la derniere synchro : elle recoit le CommandSyncStore (provenance
 * des commandes connues par serveur) + une fonction de re-deploiement REST (I/O isolee).
 * Elle DERIVE sa liste du registre via une reference paresseuse (commandsRef), pour
 * s'inclure elle-meme sans cycle a la construction.
 */
import { creerAideCommand } from './aide';
import { creerAutoRenameCommand } from './auto-rename';
import { convertCommand } from './convert';
import { pingCommand } from './ping';
import { randomCommand } from './random';
import { renameCommand } from './rename';
import { stylesCommand } from './styles';
import { creerUpdateCommand } from './update';
import type { Command } from './types';
import type { MappingStore } from '../mapping/store';
import type { CommandSyncStore } from '../command-sync/store';
import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

export interface OptionsCommandes {
  mappingStore: MappingStore;
  commandSyncStore: CommandSyncStore;
  /** PUT REST des commandes sur la guild courante (I/O Discord isolee). */
  redeploy(guildId: string, payload: RESTPostAPIApplicationCommandsJSONBody[]): Promise<void>;
}

export function creerCommandes(options: OptionsCommandes): Command[] {
  const { mappingStore, commandSyncStore, redeploy } = options;

  const commandes: Command[] = [
    pingCommand,
    stylesCommand,
    convertCommand,
    renameCommand,
    randomCommand,
    creerAutoRenameCommand(mappingStore),
    creerAideCommand(mappingStore),
  ];

  commandes.push(
    creerUpdateCommand({
      store: commandSyncStore,
      redeploy,
      commandsRef: () => commandes,
    }),
  );

  return commandes;
}
