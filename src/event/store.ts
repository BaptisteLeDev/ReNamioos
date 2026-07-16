/**
 * Port EventStore — PROVENANCE UNIQUE de l'evenement stylise (« Style Party ») par guilde.
 *
 * Une SEULE ligne par guilde (PK = guildId) : l'invariant d'agrégat « un seul event actif a
 * la fois » est porte par le store (`demarrer` echoue si un event actif existe deja). Un event
 * ECHU (`expiresAt <= maintenant`) n'est plus actif : `getActif` l'exclut, et on peut en
 * redemarrer un. Comme les autres stores, un seul endroit sait d'oU vient la donnee (Neon par
 * serveur, ou memoire en dev) ; les adapters Discord (`/event`, balayage) le consomment.
 */
import type { EvenementStyle } from "../domain/evenement-style";

export interface EventStore {
  /** L'event ACTIF de la guilde (non echu a `maintenant`), ou null. */
  getActif(guildId: string, maintenant: number): Promise<EvenementStyle | null>;
  /**
   * Demarre l'event SI aucun n'est actif (invariant). Renvoie `true` si demarre, `false` si un
   * event actif existe deja (deux events simultanes interdits). Un event echu est remplace.
   */
  demarrer(event: EvenementStyle, maintenant: number): Promise<boolean>;
  /** Arrete (supprime) l'event de la guilde et le renvoie, ou null si aucun. */
  arreter(guildId: string): Promise<EvenementStyle | null>;
  /** Events echus (`expiresAt <= maintenant`), toutes guildes — pour le balayage de cleanup. */
  listExpires(maintenant: number): Promise<EvenementStyle[]>;
}
