/**
 * Autocompletion PARTAGEE de l'option `style` (utilisee par /convert et /rename).
 *
 * Successeur de style_autocomplete_with_preview (bot.py:191). ÉCART VOLONTAIRE
 * (B4) : les 9 styles sont proposes, apercu DERIVE du domaine — le legacy avait
 * deux dicts d'exemples desynchronises (celui de /styles omettait scriptify).
 * Ici une seule source : STYLE_NAMES + convertirTexte.
 */
import type { AutocompleteInteraction } from "discord.js";
import { STYLE_NAMES } from "../domain/styles";
import { apercuStyle, capitaliser } from "./styliser";

const LIMITE_DISCORD = 25;

export async function autocompleteStyle(interaction: AutocompleteInteraction): Promise<void> {
  const saisie = interaction.options.getFocused().toLowerCase();
  const choix = STYLE_NAMES.filter((s) => s.toLowerCase().includes(saisie))
    .slice(0, LIMITE_DISCORD)
    .map((style) => ({
      name: `${capitaliser(style)} - ${apercuStyle(style, "ABC")}`,
      value: style,
    }));
  await interaction.respond(choix);
}
