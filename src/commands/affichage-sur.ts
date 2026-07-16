/**
 * Affichage SUR de contenu tiers (issue #45) — helper d'ADAPTER partage par les menus
 * contextuels qui affichent le message ou le pseudo d'un AUTRE membre.
 *
 * Un contenu non maitrise peut porter du markdown (rendu visuel detourne) et des mentions
 * (`@everyone`, `<@id>`) : meme si un embed EPHEMERE ne declenche aucune notification, on
 * neutralise a l'affichage pour que rien d'actif ne survive au copier-coller. Complementaire
 * de `assainirSource` (domaine, stylisation.ts) qui retire les caracteres INVISIBLES/zalgo
 * AVANT stylisation ; ici on casse le rendu markdown/mentions POUR l'affichage.
 *
 * Pur (aucun client Discord) : `escapeMarkdown` de discord.js est une fonction de chaine.
 */
import { escapeMarkdown } from "discord.js";

/** Casse une sequence de mention en y inserant un espace de largeur nulle (U+200B). */
const ESPACE_LARGEUR_NULLE = "​";

/**
 * Neutralise le markdown ET les mentions d'un contenu tiers pour un affichage sur.
 * `escapeMarkdown` gere `* _ ~ | > \`` ; on casse ensuite `@everyone`/`@here` et les
 * mentions `<@id>` / `<@&id>` / `<#id>` (l'espace de largeur nulle rend la sequence inerte
 * sans retirer le texte, qui reste lisible).
 */
export function neutraliserAffichage(texte: string): string {
  return escapeMarkdown(texte)
    .replace(/@(everyone|here)/g, `@${ESPACE_LARGEUR_NULLE}$1`)
    .replace(/<(@[!&]?|#)(\d+)>/g, `<$1${ESPACE_LARGEUR_NULLE}$2>`);
}
