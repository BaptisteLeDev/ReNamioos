/**
 * Registre des commandes slash. Toute nouvelle commande s'ajoute ici.
 */
import { aideCommand } from './aide';
import { convertCommand } from './convert';
import { pingCommand } from './ping';
import { randomCommand } from './random';
import { renameCommand } from './rename';
import { stylesCommand } from './styles';
import type { Command } from './types';

export const commands: Command[] = [
  pingCommand,
  stylesCommand,
  convertCommand,
  renameCommand,
  randomCommand,
  aideCommand,
];
