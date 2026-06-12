/**
 * Logique PURE du suivi d'usage des commandes (issue #27).
 *
 * Le bot compte les commandes executees par JOUR (UTC). /stats expose la serie
 * `commandsDaily` : les 30 derniers jours, du plus ancien au plus recent. Cette
 * derivation (fenetre glissante + tri ascendant) est une fonction pure, testable en
 * memoire, sans discord.js ni Neon. L'adapter (src/command-usage) persiste/cache le
 * compteur ; le dispatch (client.ts) l'incremente.
 *
 * Choix de contrat : un jour SANS commande n'apparait PAS (pas de padding a zero). Donc
 * `[]` quand rien n'a ete observe, fidele au contrat (« [] si rien »). Le consommateur
 * (front /stats) decide s'il comble les trous a l'affichage.
 */

/** Nombre de jours glissants exposes par /stats (fenetre `commandsDaily`). */
export const FENETRE_COMMANDS_DAILY_JOURS = 30;

/** Un jour observe et son total de commandes. `day` au format "AAAA-MM-JJ" (UTC). */
export interface CompteJournalier {
  /** Jour UTC au format "AAAA-MM-JJ". */
  day: string;
  /** Nombre de commandes executees ce jour-la. */
  count: number;
}

/** Cle de jour UTC "AAAA-MM-JJ" d'une date (sans glissement de fuseau). */
export function cleJourUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Borne basse (incluse) de la fenetre des N derniers jours pour `now` : la cle du jour
 * J-(N-1). Tout jour >= cette cle est dans la fenetre.
 */
function bornBasse(now: Date, joursFenetre: number): string {
  const debut = new Date(now);
  debut.setUTCDate(debut.getUTCDate() - (joursFenetre - 1));
  return cleJourUtc(debut);
}

/**
 * Serie `commandsDaily` du contrat /stats : les jours observes dans la fenetre des
 * {@link FENETRE_COMMANDS_DAILY_JOURS} derniers jours (UTC), tries par jour ascendant.
 * Renvoie `[]` si aucun jour n'est dans la fenetre.
 */
export function agregerCommandsDaily(
  comptes: readonly CompteJournalier[],
  now: Date,
  joursFenetre: number = FENETRE_COMMANDS_DAILY_JOURS,
): CompteJournalier[] {
  const min = bornBasse(now, joursFenetre);
  return comptes
    .filter((c) => c.day >= min && c.day <= cleJourUtc(now))
    .map((c) => ({ day: c.day, count: c.count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
