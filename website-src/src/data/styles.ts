// @generated par scripts/gen-styles.mjs depuis ../styles.json — NE PAS ÉDITER À LA MAIN.
// Régénérer : `pnpm run gen` (ou `node scripts/gen-styles.mjs`). Lancé en prebuild.
/**
 * Les 8 styles OFFICIELS de ReNamioos exposés sur le site.
 *
 * Langage ubiquitaire :
 *  - « style »  : une police Unicode nommée que le bot applique à un pseudo.
 *  - « aperçu » : le rendu d'un pseudo d'exemple dans ce style, montré tel quel.
 *  - « pseudo » : le surnom (nickname) d'un membre Discord.
 *
 * Les aperçus (`preview`) sont CALCULÉS à partir des mappings officiels du bot
 * (`styles.json`) — pas saisis à la main, pour ne jamais diverger du rendu réel.
 * Le site n'embarque pas l'algorithme de conversion ; il en applique seulement
 * la table, au build. Le 9e style interne « scriptify » n'est pas exposé.
 */
export interface Style {
  /** Identifiant utilisé par /convert et /rename (ex. "cursive"). */
  readonly id: string;
  /** Libellé humain affiché (FR). */
  readonly name: string;
  /** Une ligne décrivant le caractère du style. */
  readonly blurb: string;
  /** Aperçu : un pseudo d'exemple rendu dans ce style. */
  readonly preview: string;
}

/** Pseudo d'exemple servant de fil rouge à travers les aperçus. */
export const SAMPLE = "Baptiste";

export const STYLES: readonly Style[] = [
  {"id":"cercles","name":"Cercles","blurb":"Lettres encerclées, rondes et bien visibles.","preview":"🅑🅐🅟🅣🅘🅢🅣🅔"},
  {"id":"cursive","name":"Cursive","blurb":"Une anglaise élégante, lisible et raffinée.","preview":"𝓑𝓪𝓹𝓽𝓲𝓼𝓽𝓮"},
  {"id":"gothique","name":"Gothique","blurb":"Fraktur médiévale au caractère affirmé.","preview":"𝔅𝔞𝔭𝔱𝔦𝔰𝔱𝔢"},
  {"id":"gras","name":"Gras","blurb":"Sans-serif appuyé pour une emphase franche.","preview":"𝗕𝗮𝗽𝘁𝗶𝘀𝘁𝗲"},
  {"id":"monospace","name":"Monospace","blurb":"Chasse fixe, esprit terminal et code.","preview":"𝙱𝚊𝚙𝚝𝚒𝚜𝚝𝚎"},
  {"id":"carres","name":"Carrés","blurb":"Lettres encadrées, look pixel et arcade.","preview":"🄱🄰🄿🅃🄸🅂🅃🄴"},
  {"id":"double","name":"Double","blurb":"Double-struck ajouré, signature mathématique.","preview":"𝔹𝕒𝕡𝕥𝕚𝕤𝕥𝕖"},
  {"id":"fullwidth","name":"Fullwidth","blurb":"Pleine chasse aérée, vibe rétro japonisante.","preview":"Ｂａｐｔｉｓｔｅ"},
] as const;

/** Quelques pseudos vitrine pour le hero (aperçus prêts à afficher). */
export interface Showcase {
  readonly label: string;
  readonly style: string;
  readonly preview: string;
}

export const HERO_SHOWCASE: readonly Showcase[] = [
  {"label":"Aurora","style":"cursive","preview":"𝓐𝓾𝓻𝓸𝓻𝓪"},
  {"label":"Nova","style":"gothique","preview":"𝔑𝔬𝔳𝔞"},
  {"label":"Sora","style":"double","preview":"𝕊𝕠𝕣𝕒"},
  {"label":"Mika","style":"cercles","preview":"🅜🅘🅚🅐"},
  {"label":"Discord","style":"fullwidth","preview":"Ｄｉｓｃｏｒｄ"},
] as const;
