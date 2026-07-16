/**
 * Adapter NEON du port EventStore. Persiste l'event stylise (une ligne par guilde) dans la
 * table `style_event`. COLD-PATH (commande admin `/event` + balayage periodique) : aucun cache
 * necessaire, l'invariant « un seul actif » est verifie a chaque `demarrer` (select puis upsert).
 *
 * La ligne unique par guilde (PK = guildId) et la revalidation du style en lecture (parseStyleName)
 * suivent les conventions des autres stores Neon de ReNamioos. Un style corrompu en base rend
 * l'event inerte (traite comme absent), avec un warn — jamais de catch silencieux.
 *
 * Requetes INJECTEES (`EventQueries`) : le SQL/drizzle vit dans neon-queries.ts.
 */
import type { EvenementStyle } from "../domain/evenement-style";
import { estEchu } from "../domain/rename-temporaire";
import { parseStyleName } from "../domain/styles";
import type { EventStore } from "./store";

/** Enregistrement brut (styleName non revalide) tel que lu/ecrit en base. */
export interface EnregistrementEvent {
  guildId: string;
  roleId: string;
  styleName: string;
  startedAt: number;
  expiresAt: number;
}

/** Frontiere d'I/O injectable : tout l'acces Postgres passe par ces fonctions. */
export interface EventQueries {
  selectOne(guildId: string): Promise<EnregistrementEvent | null>;
  selectAll(): Promise<EnregistrementEvent[]>;
  upsert(record: EnregistrementEvent): Promise<void>;
  deleteOne(guildId: string): Promise<void>;
}

/** Revalide un enregistrement brut en EvenementStyle, ou null si le style est corrompu. */
function versEvenement(record: EnregistrementEvent): EvenementStyle | null {
  const style = parseStyleName(record.styleName);
  if (style === null) {
    console.warn(
      `Style d'event invalide en base (guilde ${record.guildId}, valeur ` +
        `${JSON.stringify(record.styleName)}) : event ignore (traite comme absent).`,
    );
    return null;
  }
  return {
    guildId: record.guildId,
    roleId: record.roleId,
    style,
    startedAt: record.startedAt,
    expiresAt: record.expiresAt,
  };
}

export function creerNeonEventStore(queries: EventQueries): EventStore {
  async function actif(guildId: string, maintenant: number): Promise<EvenementStyle | null> {
    const record = await queries.selectOne(guildId);
    if (record === null) return null;
    const event = versEvenement(record);
    if (event === null || estEchu(event.expiresAt, maintenant)) return null;
    return event;
  }

  return {
    getActif: actif,

    async demarrer(event, maintenant) {
      if ((await actif(event.guildId, maintenant)) !== null) return false;
      await queries.upsert({
        guildId: event.guildId,
        roleId: event.roleId,
        styleName: event.style,
        startedAt: event.startedAt,
        expiresAt: event.expiresAt,
      });
      return true;
    },

    async arreter(guildId) {
      const record = await queries.selectOne(guildId);
      await queries.deleteOne(guildId);
      return record ? versEvenement(record) : null;
    },

    async listExpires(maintenant) {
      const records = await queries.selectAll();
      const echus: EvenementStyle[] = [];
      for (const record of records) {
        const event = versEvenement(record);
        if (event !== null && estEchu(event.expiresAt, maintenant)) echus.push(event);
      }
      return echus;
    },
  };
}
