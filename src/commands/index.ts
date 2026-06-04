/**
 * Registre des commandes slash. Toute nouvelle commande s'ajoute ici.
 */
import { pingCommand } from './ping';
import type { Command } from './types';

export const commands: Command[] = [pingCommand];
