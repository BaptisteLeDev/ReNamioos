/**
 * File a DEBIT BORNE : traite une liste d'items SEQUENTIELLEMENT (un a la fois), avec un delai
 * optionnel entre deux. Utilisee pour les editions de pseudo en masse (Style Party) : elle
 * EMPECHE le `Promise.all` qui saturerait le rate-limit Discord (des centaines de member.edit
 * simultanes). L'abstraction est MERITEE : elle centralise et impose la discipline de debit.
 *
 * Best effort : une erreur sur un item est capturee (comptee dans `echecs`) et n'interrompt PAS
 * le traitement des suivants — jamais de silence total, le bilan {traites, echecs} est renvoye a
 * l'appelant, qui decide de la trace. Pur vis-a-vis de discord.js ; l'attente est injectable.
 */
export interface OptionsFile {
  /** Delai (ms) entre deux traitements consecutifs (espace le debit). Defaut : 0. */
  delaiMs?: number;
  /** Attente injectable (tests). Defaut : setTimeout. */
  attendre?: (ms: number) => Promise<void>;
}

/** Bilan d'un passage : nombre d'items traites avec succes et en echec. */
export interface BilanFile {
  traites: number;
  echecs: number;
}

const attendreParDefaut = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function traiterEnFile<T>(
  items: readonly T[],
  traiter: (item: T) => Promise<void>,
  options: OptionsFile = {},
): Promise<BilanFile> {
  const delaiMs = options.delaiMs ?? 0;
  const attendre = options.attendre ?? attendreParDefaut;
  const bilan: BilanFile = { traites: 0, echecs: 0 };

  for (let i = 0; i < items.length; i++) {
    try {
      await traiter(items[i]!);
      bilan.traites += 1;
    } catch {
      // Best effort : l'echec est comptabilise, le traitement continue (l'appelant trace le bilan).
      bilan.echecs += 1;
    }
    if (delaiMs > 0 && i < items.length - 1) await attendre(delaiMs);
  }
  return bilan;
}
