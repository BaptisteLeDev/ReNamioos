/**
 * Génère `src/data/styles.ts` à partir de la source de vérité du bot
 * (`../styles.json`, les mappings Unicode officiels de ReNamioos).
 *
 * POURQUOI : les aperçus affichés sur le site DOIVENT être exactement ce que le
 * bot rend. Saisir les chaînes Unicode à la main mélange les familles de glyphes
 * (ex. un cercle plein 🅑 suivi de cercles évidés ⓐⓟ…) et ment sur le rendu réel.
 * Ce script applique mécaniquement les mappings du bot — anti-corruption layer :
 * la donnée Unicode a UNE seule source de vérité (styles.json).
 *
 * Ce qui reste éditorial (et vit ici, pas dans styles.json) : l'ordre des styles
 * exposés, leurs libellés/descriptions FR, le pseudo d'exemple, et la vitrine du
 * hero. Le 9e style interne `scriptify` n'est volontairement pas exposé.
 *
 * Usage : `node scripts/gen-styles.mjs` (lancé par `pnpm run gen` / `prebuild`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, "../../styles.json");
const TARGET = resolve(HERE, "../src/data/styles.ts");

/** Pseudo d'exemple servant de fil rouge à travers les aperçus. */
const SAMPLE = "Baptiste";

/**
 * Styles exposés publiquement, dans l'ordre d'affichage, avec leur contenu
 * éditorial FR. `id` doit exister dans styles.json. `scriptify` est exclu.
 */
const EXPOSED = [
  { id: "cercles",   name: "Cercles",   blurb: "Lettres encerclées, rondes et bien visibles." },
  { id: "cursive",   name: "Cursive",   blurb: "Une anglaise élégante, lisible et raffinée." },
  { id: "gothique",  name: "Gothique",  blurb: "Fraktur médiévale au caractère affirmé." },
  { id: "gras",      name: "Gras",      blurb: "Sans-serif appuyé pour une emphase franche." },
  { id: "monospace", name: "Monospace", blurb: "Chasse fixe, esprit terminal et code." },
  { id: "carres",    name: "Carrés",    blurb: "Lettres encadrées, look pixel et arcade." },
  { id: "double",    name: "Double",    blurb: "Double-struck ajouré, signature mathématique." },
  { id: "fullwidth", name: "Fullwidth", blurb: "Pleine chasse aérée, vibe rétro japonisante." },
];

/** Vitrine du hero : pseudo d'exemple + style, l'aperçu est calculé. */
const HERO_SHOWCASE = [
  { label: "Aurora",  style: "cursive" },
  { label: "Nova",    style: "gothique" },
  { label: "Sora",    style: "double" },
  { label: "Mika",    style: "cercles" },
  { label: "Discord", style: "fullwidth" },
];

const MAPS = JSON.parse(readFileSync(SOURCE, "utf8"));

/** Applique le mapping d'un style à un mot (caractères non mappés laissés tels quels). */
function stylize(word, styleId) {
  const map = MAPS[styleId];
  if (!map) throw new Error(`Style inconnu dans styles.json : "${styleId}"`);
  return [...word].map((ch) => map[ch] ?? ch).join("");
}

const styles = EXPOSED.map((s) => ({ ...s, preview: stylize(SAMPLE, s.id) }));
const showcase = HERO_SHOWCASE.map((s) => ({ ...s, preview: stylize(s.label, s.style) }));

const out = `// @generated par scripts/gen-styles.mjs depuis ../styles.json — NE PAS ÉDITER À LA MAIN.
// Régénérer : \`pnpm run gen\` (ou \`node scripts/gen-styles.mjs\`). Lancé en prebuild.
/**
 * Les 8 styles OFFICIELS de ReNamioos exposés sur le site.
 *
 * Langage ubiquitaire :
 *  - « style »  : une police Unicode nommée que le bot applique à un pseudo.
 *  - « aperçu » : le rendu d'un pseudo d'exemple dans ce style, montré tel quel.
 *  - « pseudo » : le surnom (nickname) d'un membre Discord.
 *
 * Les aperçus (\`preview\`) sont CALCULÉS à partir des mappings officiels du bot
 * (\`styles.json\`) — pas saisis à la main, pour ne jamais diverger du rendu réel.
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
export const SAMPLE = ${JSON.stringify(SAMPLE)};

export const STYLES: readonly Style[] = [
${styles.map((s) => `  ${JSON.stringify(s)},`).join("\n")}
] as const;

/** Quelques pseudos vitrine pour le hero (aperçus prêts à afficher). */
export interface Showcase {
  readonly label: string;
  readonly style: string;
  readonly preview: string;
}

export const HERO_SHOWCASE: readonly Showcase[] = [
${showcase.map((s) => `  ${JSON.stringify(s)},`).join("\n")}
] as const;
`;

writeFileSync(TARGET, out, "utf8");
console.log(`styles.ts généré depuis ${SOURCE} (${styles.length} styles, ${showcase.length} vitrines).`);
