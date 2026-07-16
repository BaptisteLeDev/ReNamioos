/**
 * Decorateur de cache (port -> port) du GuildSettingsStore (socle). Reduit les lectures
 * de l'adapter sous-jacent (Neon) : les reglages d'une guilde sont mis en cache par
 * guilde, avec un TTL borne. Les ecritures INVALIDENT l'entree de cache
 * (write-invalidate) : la prochaine lecture recharge la valeur autoritative depuis
 * l'inner. On troque une micro-optim (un set evitait une relecture) contre la coherence :
 * un write-through partiel effacerait, sur cache froid, l'autre champ deja persiste en DB
 * pendant tout le TTL (regression de /config).
 *
 * Garde ANTI-RACE reprise du Neon-store de ReNamioos (mapping / original-nick) : chaque
 * guilde porte une GENERATION incrementee a chaque invalidation. Un read en vol capture
 * la generation a son demarrage et ne peuple le cache QUE si elle n'a pas change pendant
 * l'await -> une ecriture concurrente (qui a invalide) n'est jamais masquee par le
 * snapshot perime d'un read plus lent.
 *
 * Hypothese MONO-PROCESS (D14) : un conteneur par bot -> cache in-process coherent. Un
 * scaling horizontal exigerait une invalidation cross-process (hors perimetre) ; le TTL
 * borne alors la staleness a `ttlMs`.
 */
import type { GuildSettings, GuildSettingsStore } from "./store";

const TTL_DEFAUT_MS = 60_000;

interface Entree {
  valeur: GuildSettings;
  expireA: number;
}

export function creerCachedGuildSettingsStore(
  inner: GuildSettingsStore,
  options: { ttlMs?: number; maintenant?: () => number } = {},
): GuildSettingsStore {
  const ttlMs = options.ttlMs ?? TTL_DEFAUT_MS;
  const maintenant = options.maintenant ?? Date.now;
  const cache = new Map<string, Entree>();
  const generation = new Map<string, number>();
  const genDe = (guildId: string): number => generation.get(guildId) ?? 0;

  function invalider(guildId: string): void {
    generation.set(guildId, genDe(guildId) + 1);
    cache.delete(guildId);
  }

  return {
    async get(guildId): Promise<GuildSettings> {
      const entree = cache.get(guildId);
      if (entree !== undefined && maintenant() < entree.expireA) {
        return entree.valeur;
      }
      const genAuDepart = genDe(guildId);
      const valeur = await inner.get(guildId);
      // Ne peupler le cache que si aucune invalidation n'est survenue pendant le read.
      if (genDe(guildId) === genAuDepart) {
        cache.set(guildId, { valeur, expireA: maintenant() + ttlMs });
      }
      return valeur;
    },
    async setLocale(guildId, locale): Promise<void> {
      await inner.setLocale(guildId, locale);
      invalider(guildId);
    },
    async setEmbedColor(guildId, color): Promise<void> {
      await inner.setEmbedColor(guildId, color);
      invalider(guildId);
    },
  };
}
