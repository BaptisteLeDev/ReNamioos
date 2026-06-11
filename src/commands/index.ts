/**
 * Registre des commandes slash. Toute nouvelle commande s'ajoute ici.
 *
 * Fabrique : la plupart des commandes sont des objets statiques, mais /aide et
 * /auto-rename dependent de la PROVENANCE de la config auto-rename. Depuis B8
 * (ADR-0005) celle-ci est le port MappingStore (Neon par serveur, ou fichier en
 * dev), injecte a la composition (src/client.ts). On expose donc une fabrique qui
 * recoit le store ; le deploiement des slash (deploy-commands.ts) passe un store
 * fichier vide (suffisant pour produire le SCHEMA des commandes).
 */
import { creerAideCommand } from './aide';
import { creerAutoRenameCommand } from './auto-rename';
import { convertCommand } from './convert';
import { pingCommand } from './ping';
import { previewCommand } from './preview';
import { randomCommand } from './random';
import { renameCommand } from './rename';
import { stylesCommand } from './styles';
import type { Command } from './types';
import type { MappingStore } from '../mapping/store';

export function creerCommandes(mappingStore: MappingStore): Command[] {
  return [
    pingCommand,
    stylesCommand,
    convertCommand,
    previewCommand,
    renameCommand,
    randomCommand,
    creerAutoRenameCommand(mappingStore),
    creerAideCommand(mappingStore),
  ];
}
