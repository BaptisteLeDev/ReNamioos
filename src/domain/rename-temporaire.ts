/**
 * Logique PURE du renommage temporaire / programme (issue #38).
 *
 * Le renommage temporaire reutilise la persistance du pseudo d'origine (#25) en lui
 * ajoutant une ECHEANCE : `/rename ... duree:2h` memorise le pseudo courant et fixe une
 * date de revert ; un job de balayage restaure les pseudos echus. Ce module ne contient
 * que les deux decisions PURES, sans I/O ni discord.js (invariant ACL, ADR-0002) :
 *
 *  1. `parserEcheance` : traduit une saisie utilisateur (duree relative `2h`/`30m`/`7j`
 *     ou date ISO absolue) en epoch ms, a partir d'un `maintenant` injecte (testable).
 *  2. `estEchu` : « faut-il reverter maintenant ? » — vrai SSI l'echeance <= maintenant.
 *     C'est le predicat applique par le job de balayage a chaque ligne (sweep-temporaire).
 */

/** Unites de duree acceptees -> millisecondes. `j` = jour (FR). */
const UNITES_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  j: 86_400_000,
};

/** Plafond anti-echeance absurde : 1 an. Au-dela, on refuse (saisie probablement erronee). */
export const ECHEANCE_MAX_MS = 365 * 86_400_000;

/** Resultat du parsing : echeance absolue (epoch ms) ou raison de refus. */
export type EcheanceParsee =
  | { ok: true; expiresAt: number }
  | { ok: false; raison: "format" | "passe" | "trop-longue" };

/** `^<nombre><unite>$` (ex. `2h`, `30m`, `7j`), insensible a la casse, espaces tolers. */
const DUREE_RELATIVE = /^(\d+)\s*([mhj])$/;

/**
 * Traduit une saisie en echeance absolue (epoch ms), relative a `maintenant`.
 *
 * Accepte soit une duree relative (`2h`, `30m`, `7j`), soit une date ISO absolue
 * (`2026-06-14T12:00:00Z`). Refuse : format inconnu, duree nulle/negative, echeance dans
 * le passe, ou duree > plafond (ECHEANCE_MAX_MS).
 */
export function parserEcheance(saisie: string, maintenant: number): EcheanceParsee {
  const s = saisie.trim().toLowerCase();
  if (s.length === 0) return { ok: false, raison: "format" };

  const m = DUREE_RELATIVE.exec(s);
  if (m) {
    const valeur = Number(m[1]);
    const unite = UNITES_MS[m[2]!]!;
    if (valeur <= 0) return { ok: false, raison: "format" };
    const delta = valeur * unite;
    if (delta > ECHEANCE_MAX_MS) return { ok: false, raison: "trop-longue" };
    return { ok: true, expiresAt: maintenant + delta };
  }

  // Pas une duree relative : tenter une date absolue ISO.
  const absolue = Date.parse(saisie.trim());
  if (Number.isNaN(absolue)) return { ok: false, raison: "format" };
  if (absolue <= maintenant) return { ok: false, raison: "passe" };
  if (absolue - maintenant > ECHEANCE_MAX_MS) return { ok: false, raison: "trop-longue" };
  return { ok: true, expiresAt: absolue };
}

/**
 * « Faut-il reverter maintenant ? » Predicat PUR du job de balayage : une echeance est
 * echue (le pseudo doit etre restaure) SSI elle est <= maintenant.
 */
export function estEchu(expiresAt: number, maintenant: number): boolean {
  return expiresAt <= maintenant;
}
