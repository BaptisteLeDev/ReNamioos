/**
 * Reponse d'erreur de SECOURS du routeur d'interactions (T1/audit).
 *
 * Le routeur (client.ts `handleInteraction`) est branche via `void handleInteraction(...)` :
 * toute promesse rejetee non capturee y devient un unhandledRejection (crash possible cOte
 * Node, bruit cOte Bun) ET le feedback utilisateur est perdu. Quand la commande jette, on
 * tente une reponse d'erreur generique ; mais ce reply/followUp de secours peut LUI AUSSI
 * echouer (10062 « Unknown interaction » sur cold-start, 40060 « already acknowledged »).
 *
 * Cette fonction GARDE donc la reponse de secours dans son propre try/catch : en cas d'echec,
 * elle LOG (jamais de catch silencieux) et resout normalement. Isolee ici pour etre testable
 * sans instancier un vrai Client Discord.
 */

/** Sous-ensemble d'interaction repondable dont depend la reponse de secours. */
export interface InteractionRepondable {
  replied: boolean;
  deferred: boolean;
  reply(payload: { content: string; ephemeral: boolean }): Promise<unknown>;
  followUp(payload: { content: string; ephemeral: boolean }): Promise<unknown>;
}

export async function repondreErreurRouteur(
  interaction: InteractionRepondable,
  commandName: string,
  log: (message: string, err: unknown) => void = (m, err) => console.error(m, err),
): Promise<void> {
  const payload = { content: "Une erreur est survenue.", ephemeral: true };
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (err) {
    // La reponse de secours a elle-meme echoue (interaction expiree/deja acquittee) : on trace
    // et on abandonne le feedback plutOt que de laisser un unhandledRejection remonter.
    log(`Echec de la reponse d'erreur de secours pour /${commandName} :`, err);
  }
}
