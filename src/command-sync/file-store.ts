/**
 * Adapter FICHIER du port CommandSyncStore (mode DEV, sans DATABASE_URL).
 *
 * Persiste l'instantane par serveur dans un petit JSON local ({ [guildId]: names[] }).
 * Contrairement au file-store auto-rename (lecture seule, edite a la main), celui-ci
 * DOIT ecrire : /update enregistre la synchro a chaque execution pour pouvoir detecter
 * les nouvelles commandes au prochain appel. Le fichier est cree paresseusement.
 *
 * I/O fichier injectee (lire/ecrire) pour rester testable sans toucher au disque.
 */
import { readFile, writeFile } from 'node:fs/promises';
import type { CommandSyncStore } from './store';

type Snapshot = Record<string, string[]>;

export interface FileIo {
  read(): Promise<string | null>;
  write(content: string): Promise<void>;
}

/** I/O fichier reelle, par defaut. Lecture tolerante (fichier absent => null). */
export function creerFileIo(path: string): FileIo {
  return {
    async read() {
      try {
        return await readFile(path, 'utf8');
      } catch {
        return null;
      }
    },
    async write(content) {
      await writeFile(path, content, 'utf8');
    },
  };
}

async function charger(io: FileIo): Promise<Snapshot> {
  const raw = await io.read();
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Snapshot) : {};
  } catch {
    return {};
  }
}

export function creerFileCommandSyncStore(io: FileIo): CommandSyncStore {
  return {
    async getKnown(guildId) {
      const snap = await charger(io);
      return snap[guildId] ?? [];
    },
    async record(guildId, names) {
      const snap = await charger(io);
      snap[guildId] = [...names];
      await io.write(JSON.stringify(snap));
    },
  };
}
