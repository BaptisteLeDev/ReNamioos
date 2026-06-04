/**
 * Provenance des donnees du domaine de stylisation (mandat ARCHITECTURE.md :
 * un seul endroit sait d'ou vient la donnee). Successeur versionne de
 * `styles.json` / `role.json` du legacy, charge comme config FICHIER — aucune DB
 * (cf. decisions/0002-pattern-starter.md, decision 3).
 *
 * PUR : aucune dependance a Discord.js / Fastify / I/O reseau. Les tables de
 * glyphes (`STYLES`), le mapping chiffres->lettres (`CONVERSIONS`) et le mapping
 * roles->styles (`ROLE_CONFIG`) proviennent de `data/styles.json` et
 * `data/roles.json`, importes au build. C'est la table AUTORITAIRE : le pipeline
 * (`stylisation.ts`) ne connait que ces structures, jamais les fichiers bruts.
 */
import stylesData from './data/styles.json';
import rolesData from './data/roles.json';

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

/** Mapping role->style pour l'auto-rename (successeur de role.json). */
export const ROLE_CONFIG: Record<string, string[]> = rolesData as Record<string, string[]>;
