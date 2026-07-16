/**
 * Composition du CommandSyncStore — point d'entree du module (cf. mapping/index.ts).
 *
 * Branche le bon adapter selon la presence de DATABASE_URL :
 *  - SANS url => FileCommandSyncStore (mode dev, persistance JSON locale).
 *  - AVEC url => NeonCommandSyncStore (par serveur, table guild_command_sync).
 *
 * Les queries Neon sont creees ici via getDb (init paresseuse du Pool) sauf override (tests).
 */
import { getDb } from "../db/client";
import type { CommandSyncStore } from "./store";
import { creerNeonCommandSyncStore, type CommandSyncQueries } from "./neon-store";
import { creerCommandSyncQueries } from "./neon-queries";
import { creerFileCommandSyncStore, creerFileIo } from "./file-store";

export type { CommandSyncStore } from "./store";

const FICHIER_DEV_PAR_DEFAUT = "command-sync.json";

export interface OptionsCommandSyncStore {
  /** URL Postgres Neon. Absente => mode fichier (dev). */
  databaseUrl: string | undefined;
  /** Chemin du JSON de synchro en mode fichier. Defaut : command-sync.json. */
  filePath?: string;
  /** Override des queries Neon (tests). Par defaut : creees via getDb(databaseUrl). */
  queries?: CommandSyncQueries;
}

export function creerCommandSyncStore(options: OptionsCommandSyncStore): CommandSyncStore {
  if (!options.databaseUrl) {
    return creerFileCommandSyncStore(creerFileIo(options.filePath ?? FICHIER_DEV_PAR_DEFAUT));
  }
  const queries = options.queries ?? creerCommandSyncQueries(getDb(options.databaseUrl));
  return creerNeonCommandSyncStore(queries);
}
