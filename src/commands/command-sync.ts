/**
 * Diff de synchronisation des commandes — coeur PUR de /update (sans I/O).
 *
 * A partir des commandes actuellement enregistrees en memoire (`available`) et de
 * la liste deja synchronisee pour un serveur (`known`, depuis le store), calcule :
 *   - `available` : la liste complete triee+dedupliquee (ce que le serveur a ce jour) ;
 *   - `added` : les noms presents maintenant mais absents de la derniere synchro (le
 *     set "🆕 nouvelles").
 *
 * Aucune dependance Discord/DB : testable en memoire (mandat ARCHITECTURE.md).
 */

export interface CommandDiff {
  /** Tous les noms de commandes disponibles, tries, dedupliques. */
  available: string[];
  /** Noms disponibles maintenant mais absents de la derniere synchro. */
  added: string[];
}

/**
 * @param available noms des commandes enregistrees en memoire maintenant
 * @param known     noms enregistres a la derniere synchro de ce serveur (vide = jamais)
 */
export function diffCommands(
  available: readonly string[],
  known: readonly string[] = [],
): CommandDiff {
  const knownSet = new Set(known);
  const availableSorted = [...new Set(available)].toSorted((a, b) => a.localeCompare(b));
  const added = availableSorted.filter((name) => !knownSet.has(name));
  return { available: availableSorted, added };
}
