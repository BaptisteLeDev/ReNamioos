/**
 * Adapter NEON du port GuildSettingsStore (socle). Persiste les reglages par guilde dans
 * la table `guild_settings`. Comme les autres stores Neon de ReNamioos (mapping,
 * original-nick), les fonctions de requete sont INJECTEES (`GuildSettingsQueries`) : le
 * SQL/drizzle vit dans neon-queries.ts ; ce module ne connait que des promesses (testable
 * sans DB, cf. neon-store.test.ts).
 *
 * En lecture, les VO (LocaleTag, EmbedColor) sont RE-VALIDES via leur smart constructor :
 * la colonne brute ne fuit jamais en type marque sans passer par son parseur. Une valeur
 * NON-null qui echoue au parse = donnee CORROMPUE en base : traitee comme non configuree,
 * MAIS avec un warn (jamais de catch silencieux ; on distingue corrompu de non-configure).
 *
 * Pas de cache ici : le cache par guilde (+ garde de generation) est le decorateur
 * `cached-store.ts`, applique a la composition. Cet adapter reste I/O pure + revalidation.
 */
import { parseLocale, type LocaleTag } from "../domain/locale";
import { parseEmbedColor, type EmbedColor } from "../domain/embed-color";
import { REGLAGES_DEFAUT, type GuildSettings, type GuildSettingsStore } from "./store";

/** Frontiere d'I/O injectable : tout l'acces Postgres passe par ces fonctions. */
export interface GuildSettingsQueries {
  /** Colonnes brutes de la guilde, ou null si aucune ligne. */
  selectOne(
    guildId: string,
  ): Promise<{ preferredLocale: string | null; embedColor: number | null } | null>;
  /** Upsert ciblant la colonne locale (sans toucher la couleur). `null` = efface l'override. */
  upsertLocale(guildId: string, locale: string | null): Promise<void>;
  /** Upsert ciblant la colonne couleur (sans toucher la langue). `null` = couleur defaut. */
  upsertEmbedColor(guildId: string, color: number | null): Promise<void>;
}

/**
 * Re-valide une colonne brute via son smart constructor. Une valeur NULL = "non
 * configure" (silencieux, normal). Une valeur NON-null qui echoue au parse = donnee
 * CORROMPUE en base : on la traite comme non configuree MAIS on logge un warn, pour ne
 * pas confondre silencieusement les deux cas (diagnostic d'une corruption reelle).
 */
function revalider<TBrut, T>(
  brut: TBrut | null,
  parser: (valeur: TBrut) => T | null,
  colonne: string,
  guildId: string,
): T | null {
  if (brut === null) return null;
  const valeur = parser(brut);
  if (valeur === null) {
    console.warn(
      `Reglage guild_settings.${colonne} invalide en base (guilde ${guildId}, valeur ` +
        `${JSON.stringify(brut)}) : ignore et traite comme non configure.`,
    );
  }
  return valeur;
}

export function creerNeonGuildSettingsStore(queries: GuildSettingsQueries): GuildSettingsStore {
  return {
    async get(guildId): Promise<GuildSettings> {
      const ligne = await queries.selectOne(guildId);
      if (ligne === null) return REGLAGES_DEFAUT;
      return {
        preferredLocale: revalider<string, LocaleTag>(
          ligne.preferredLocale,
          parseLocale,
          "preferred_locale",
          guildId,
        ),
        embedColor: revalider<number, EmbedColor>(
          ligne.embedColor,
          parseEmbedColor,
          "embed_color",
          guildId,
        ),
      };
    },
    setLocale(guildId, locale): Promise<void> {
      return queries.upsertLocale(guildId, locale);
    },
    setEmbedColor(guildId, color): Promise<void> {
      return queries.upsertEmbedColor(guildId, color);
    },
  };
}
