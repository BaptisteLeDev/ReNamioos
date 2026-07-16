/**
 * Balayage COMPLEMENTAIRE des events echus (« Style Party »).
 *
 * Le revert des PSEUDOS est deja assure par le sweep-temporaire (chaque membre est memorise avec
 * l'echeance de l'event, `balayerEcheances`). Ce balayage supprime seulement la LIGNE d'event
 * echue via le port EventStore (minimisation D8) : la guilde peut relancer une party et la table
 * `style_event` reste minuscule. Orchestrateur mince : la decision « echu » vit dans le domaine
 * (`estEchu`, applique par `listExpires` du store).
 */
import type { EventStore } from "../event/store";

/** Supprime les events echus a `maintenant`. Renvoie le nombre supprime (pour la trace). */
export async function nettoyerEvenementsExpires(
  eventStore: EventStore,
  maintenant: number,
): Promise<number> {
  const expires = await eventStore.listExpires(maintenant);
  for (const event of expires) {
    await eventStore.arreter(event.guildId);
  }
  return expires.length;
}
