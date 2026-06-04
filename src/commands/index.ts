/**
 * Registre des commandes slash. Toute nouvelle commande s'ajoute ici.
 *
 * Fabrique : la plupart des commandes sont des objets statiques, mais /aide
 * derive son compte « Rôles configurés » de la config auto-rename (B6, ADR-0004),
 * injectee a la composition (src/client.ts). On expose donc une fabrique qui
 * recoit le mapping ; le deploiement des slash (deploy-commands.ts) peut passer
 * un mapping vide (le compte n'apparait pas dans le schema des commandes).
 */
import { creerAideCommand } from './aide';
import { convertCommand } from './convert';
import { pingCommand } from './ping';
import { randomCommand } from './random';
import { renameCommand } from './rename';
import { stylesCommand } from './styles';
import type { Command } from './types';
import type { MappingRoleStyle } from '../domain/auto-rename';

export function creerCommandes(autoRenameMapping: MappingRoleStyle): Command[] {
  return [
    pingCommand,
    stylesCommand,
    convertCommand,
    renameCommand,
    randomCommand,
    creerAideCommand(autoRenameMapping),
  ];
}
