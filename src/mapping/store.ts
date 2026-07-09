/**
 * Port MappingStore (B8, cf. decisions/0005) — PROVENANCE UNIQUE rOle -> style.
 *
 * Successeur du chargeur fichier (ADR-0004) : c'est desormais le SEUL endroit qui
 * sait d'oU vient la config auto-rename (Neon par serveur, ou fichier en dev). Les
 * adapters Discord (commande /auto-rename, evenement guildMemberUpdate) consomment
 * ce port, jamais la source brute (mandat ARCHITECTURE.md : un seul point sait d'oU
 * vient la donnee). Changer la source = changer l'implementation du port, rien d'autre.
 *
 * La cle de partition est `guildId` : la config est PAR SERVEUR (multi-guild par
 * construction). `list` preserve l'ordre = PRIORITE (ADR-0004 : le premier rOle
 * mappe gagne en cas de gains multiples), invariant que le domaine pur exploite.
 */
import type { MappingRoleStyle } from "../domain/auto-rename";
import type { StyleName } from "../domain/styles";

export interface MappingStore {
  /** Style mappe a ce rOle dans cette guild, ou null si aucun. */
  styleForRole(guildId: string, roleId: string): Promise<StyleName | null>;
  /** Cree ou remplace le mapping (guild, rOle) -> style. */
  add(guildId: string, roleId: string, styleName: StyleName): Promise<void>;
  /** Retire le mapping de ce rOle dans cette guild (no-op s'il n'existe pas). */
  remove(guildId: string, roleId: string): Promise<void>;
  /** Mapping ORDONNE rOleId -> style de la guild (ordre = priorite). */
  list(guildId: string): Promise<MappingRoleStyle>;
}
