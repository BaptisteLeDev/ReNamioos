/**
 * L'adapter Neon du port GuildSettingsStore (socle) doit honorer le MEME contrat que
 * l'adapter en memoire. Comme les autres stores Neon de ReNamioos (original-nick,
 * mapping), on INJECTE les fonctions de requete (`GuildSettingsQueries`) : pas de
 * drizzle ni de vraie DB dans le test. La LOGIQUE (revalidation des VO depuis les
 * colonnes brutes) est testee sur des fakes.
 */
import { describe, expect, it, spyOn } from "bun:test";
import { contratGuildSettingsStore } from "./store.contract";
import { creerNeonGuildSettingsStore, type GuildSettingsQueries } from "./neon-store";

interface LigneBrute {
  preferredLocale: string | null;
  embedColor: number | null;
}

/** Fake queries : une Map par guilde, upsert ciblant UNE colonne (comme l'upsert SQL). */
function fakeQueries(initial: Record<string, LigneBrute> = {}) {
  const data = new Map<string, LigneBrute>(Object.entries(initial));
  const queries: GuildSettingsQueries = {
    selectOne: (guildId) => Promise.resolve(data.get(guildId) ?? null),
    upsertLocale: (guildId, locale) => {
      const courant = data.get(guildId) ?? { preferredLocale: null, embedColor: null };
      data.set(guildId, { ...courant, preferredLocale: locale });
      return Promise.resolve();
    },
    upsertEmbedColor: (guildId, color) => {
      const courant = data.get(guildId) ?? { preferredLocale: null, embedColor: null };
      data.set(guildId, { ...courant, embedColor: color });
      return Promise.resolve();
    },
  };
  return { queries, data };
}

contratGuildSettingsStore("neon/fake-queries", async () =>
  creerNeonGuildSettingsStore(fakeQueries().queries),
);

describe("neon-store — revalidation des colonnes brutes", () => {
  it("re-valide les colonnes via les smart constructors (type marque, jamais brut)", async () => {
    const { queries } = fakeQueries({ g1: { preferredLocale: "en", embedColor: 0x5865f2 } });
    const settings = await creerNeonGuildSettingsStore(queries).get("g1");
    expect(settings.preferredLocale).toBe("en");
    expect(settings.embedColor).toBe(0x5865f2 as never);
  });

  it("colonne NULL = non configure (silencieux, aucun warn)", async () => {
    const { queries } = fakeQueries({ g1: { preferredLocale: null, embedColor: null } });
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const settings = await creerNeonGuildSettingsStore(queries).get("g1");
    expect(settings).toEqual({ preferredLocale: null, embedColor: null });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("logge un warn quand une colonne non-null echoue au parse (corrompu != non configure)", async () => {
    // Valeur non-null mais non parsable (locale hors du jeu supporte) : distincte du cas
    // legitime "non configure" (colonne NULL). Jamais de catch silencieux.
    const { queries } = fakeQueries({ g1: { preferredLocale: "zz", embedColor: 0x1000000 } });
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    const settings = await creerNeonGuildSettingsStore(queries).get("g1");

    expect(settings.preferredLocale).toBeNull();
    expect(settings.embedColor).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
