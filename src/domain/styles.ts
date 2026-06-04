/**
 * Provenance des donnees du domaine de stylisation (mandat ARCHITECTURE.md :
 * un seul endroit sait d'ou vient la donnee). Successeur versionne de
 * `styles.json` / `role.json` du legacy, charge comme config FICHIER — aucune DB
 * (cf. decisions/0002-pattern-starter.md, decision 3).
 *
 * PUR : aucune dependance a Discord.js / Fastify / I/O reseau. Les tables de
 * glyphes (`STYLES`) et le mapping chiffres->lettres (`CONVERSIONS`) proviennent
 * de `data/styles.json`, importe au build. C'est la table AUTORITAIRE : le
 * pipeline (`stylisation.ts`) ne connait que ces structures, jamais les fichiers
 * bruts.
 *
 * Le mapping roles->styles de l'auto-rename N'EST PLUS ici : depuis B6 (ADR-0004)
 * il vit dans la config FICHIER `auto-rename.json` (roleId -> styleName), chargee
 * par src/config/auto-rename-config.ts. Source de verite UNIQUE (l'ancien
 * `ROLE_CONFIG` / `data/roles.json`, copie du legacy `role.json`, a ete retire).
 */
import stylesData from './data/styles.json';

/** Les 9 styles charges (scriptify inclus), dans l'ordre de `styles.json`. */
export const STYLE_NAMES = [
  'cercles',
  'cursive',
  'gothique',
  'gras',
  'monospace',
  'carres',
  'double',
  'fullwidth',
  'scriptify',
] as const;

export type StyleName = (typeof STYLE_NAMES)[number];

/** Table `caractere -> glyphe` d'un style (ASCII 52 lettres ; pas de chiffres). */
export type StyleMap = Record<string, string>;

/**
 * `styles.json` melange la cle `conversions` (chiffres->lettres) et les 9 styles.
 * On separe a la frontiere, comme `charger_styles()` du legacy (bot.py:32-39).
 */
const { conversions, ...stylesRaw } = stylesData as {
  conversions: Record<string, string>;
} & Record<string, StyleMap>;

/**
 * Mapping chiffre -> lettre MAJUSCULE (leet). ECART VOLONTAIRE B4 (ADR-0003,
 * decision 4) : les 10 chiffres sont mappes (2->Z, 6->G, 9->G ajoutes).
 */
export const CONVERSIONS: Record<string, string> = conversions;

/** Tables de glyphes des 9 styles, indexees par nom de style. */
export const STYLES: Record<StyleName, StyleMap> = stylesRaw as Record<StyleName, StyleMap>;
