/**
 * Adapter EN MEMOIRE du port GuildSettingsStore (socle). Reference de comportement pour
 * les tests de contrat ; l'adapter Neon doit se comporter a l'identique. C'est le defaut
 * de ReNamioos quand aucune `DATABASE_URL` n'est fournie (persistance optionnelle).
 */
import { REGLAGES_DEFAUT, type GuildSettings, type GuildSettingsStore } from "./store";

export function creerMemoryGuildSettingsStore(): GuildSettingsStore {
  const parGuild = new Map<string, GuildSettings>();

  const patch = (guildId: string, delta: Partial<GuildSettings>): void => {
    const courant = parGuild.get(guildId) ?? REGLAGES_DEFAUT;
    parGuild.set(guildId, { ...courant, ...delta });
  };

  return {
    get(guildId): Promise<GuildSettings> {
      return Promise.resolve({ ...(parGuild.get(guildId) ?? REGLAGES_DEFAUT) });
    },
    setLocale(guildId, locale): Promise<void> {
      patch(guildId, { preferredLocale: locale });
      return Promise.resolve();
    },
    setEmbedColor(guildId, color): Promise<void> {
      patch(guildId, { embedColor: color });
      return Promise.resolve();
    },
  };
}
