/**
 * Adapter MEMOIRE du port EventStore — mode DEV, sans DATABASE_URL. Un event stylise est une
 * donnee d'execution (pas de fichier source) : en dev on la tient EN MEMOIRE (ephemere, perdue
 * au redemarrage). L'invariant « un seul event actif par guilde » est porte ici comme cote Neon.
 */
import type { EvenementStyle } from "../domain/evenement-style";
import { estEchu } from "../domain/rename-temporaire";
import type { EventStore } from "./store";

export function creerMemoryEventStore(): EventStore {
  const parGuild = new Map<string, EvenementStyle>();

  return {
    getActif(guildId, maintenant) {
      const event = parGuild.get(guildId);
      if (!event || estEchu(event.expiresAt, maintenant)) return Promise.resolve(null);
      return Promise.resolve(event);
    },
    demarrer(event, maintenant) {
      const actuel = parGuild.get(event.guildId);
      // Un event NON echu bloque le demarrage (invariant). Un event echu est remplace.
      if (actuel && !estEchu(actuel.expiresAt, maintenant)) return Promise.resolve(false);
      parGuild.set(event.guildId, event);
      return Promise.resolve(true);
    },
    arreter(guildId) {
      const event = parGuild.get(guildId) ?? null;
      parGuild.delete(guildId);
      return Promise.resolve(event);
    },
    listExpires(maintenant) {
      return Promise.resolve(
        [...parGuild.values()].filter((e) => estEchu(e.expiresAt, maintenant)),
      );
    },
  };
}
