/**
 * Port StylePreferenceStore — PROVENANCE UNIQUE de la SIGNATURE de style d'un membre
 * (« style signature par membre », extension positive de l'opt-out).
 *
 * Un membre choisit SON style via `/renamioos style:<style>` : a l'auto-rename, cette
 * signature PRIME sur le style du role (regle pure `styleEffectif`, domain/auto-rename.ts).
 * Comme l'opt-out (issue #27), un seul endroit sait d'oU vient cette donnee (Neon par
 * serveur, ou memoire en dev) ; les adapters Discord la consomment, jamais la source brute.
 *
 * Cle = (guildId, memberId) : une signature PAR SERVEUR (un membre peut avoir une signature
 * differente selon le serveur). Minimisation D8 : une ligne n'existe QUE si le membre a pose
 * une signature ; `clear` (reset) SUPPRIME la ligne. La table reste minuscule.
 */
import type { StyleName } from "../domain/styles";

export interface StylePreferenceStore {
  /** La signature de style du membre sur ce serveur, ou `null` si aucune. */
  get(guildId: string, memberId: string): Promise<StyleName | null>;
  /** Pose (ou remplace) la signature du membre sur ce serveur. */
  set(guildId: string, memberId: string, style: StyleName): Promise<void>;
  /** Supprime la signature = revient au style du role (idempotent : no-op si absente). */
  clear(guildId: string, memberId: string): Promise<void>;
}
