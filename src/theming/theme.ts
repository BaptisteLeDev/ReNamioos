/**
 * Theme de ReNamioos (CONFIG, hors domaine). Constantes de charte injectees a la
 * composition : couleur et footer par defaut. C'est LE point unique a modifier pour
 * rebrander le bot.
 *
 * `couleurDefaut` = le bleu de marque de ReNamioos (0x3498db, = `COULEUR_BLEU` de
 * `commands/couleurs.ts`) : les embeds routes par la fabrique gardent l'aspect actuel
 * tant qu'aucune guilde n'a pose de couleur via `/config`. La consolidation complete de
 * `couleurs.ts` (VERT/VIOLET) dans le theme releve de l'extraction ulterieure (les autres
 * teintes sont semantiques par commande, hors des 1-2 embeds routes ici).
 *
 * Ne depend pas de discord.js : ce sont de simples valeurs. La couleur passe par
 * `parseEmbedColor` -> une couleur de theme invalide est impossible a construire.
 */
import { parseEmbedColor, type EmbedColor } from "../domain/embed-color";

export interface Theme {
  /** Couleur d'embed par defaut du bot (surchargee par guilde via /config). */
  readonly couleurDefaut: EmbedColor;
  /** Footer par defaut, ou `null` pour ne pas afficher de footer. */
  readonly footerDefaut: string | null;
}

/** Bleu de marque ReNamioos ; footer neutre (aucun). */
export const THEME_RENAMIOOS: Theme = {
  couleurDefaut: parseEmbedColor(0x3498db)!,
  footerDefaut: null,
};
