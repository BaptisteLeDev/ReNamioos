/**
 * Adapter FICHIER du port MappingStore (B8, ADR-0005).
 *
 * Enrobe l'ancien `auto-rename.json` (ADR-0004) pour le mode DEV, sans DATABASE_URL.
 * Le fichier est GLOBAL (pas de partition par guild) : toutes les guilds partagent
 * le meme mapping. C'est un compromis assume du mode dev ; la config PAR SERVEUR
 * (issue #19) n'existe qu'en mode Neon.
 *
 * Le mapping est INJECTE deja charge et valide (le chargeur+validation zod reste
 * src/config/auto-rename-config.ts) : ce store ne touche pas au disque. L'ECRITURE
 * n'est pas supportee (le fichier dev s'edite a la main) : add/remove levent une
 * erreur explicite, dirigeant vers Neon pour la config modifiable depuis Discord.
 */
import type { MappingRoleStyle } from '../domain/auto-rename';
import type { MappingStore } from './store';

const ERREUR_LECTURE_SEULE =
  'Mode fichier (dev) en LECTURE SEULE : la config auto-rename modifiable depuis ' +
  'Discord exige le mode Neon (definir DATABASE_URL). Edite auto-rename.json a la main en dev.';

export function creerFileMappingStore(mapping: MappingRoleStyle): MappingStore {
  return {
    styleForRole(_guildId, roleId) {
      return Promise.resolve(mapping[roleId] ?? null);
    },
    add() {
      return Promise.reject(new Error(ERREUR_LECTURE_SEULE));
    },
    remove() {
      return Promise.reject(new Error(ERREUR_LECTURE_SEULE));
    },
    list() {
      return Promise.resolve({ ...mapping });
    },
  };
}
