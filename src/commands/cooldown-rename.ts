/**
 * Cooldown anti mass-rename PARTAGÉ par /rename et /random (B1, batch #45).
 *
 * Couche de TRADUCTION : extrait la clé de limitation (invocateur + guilde) de
 * l'interaction Discord et délègue la décision au compteur à fenêtre glissante
 * (src/limitation/compteur-fenetre, lui-même adossé à la règle pure du domaine).
 * Centralise ici la clé ET le message d'attente pour que /rename et /random ne les
 * dupliquent pas (règle de 3 : deux usages -> une seule source).
 *
 * La limite (3 renommages / 60 s) est portée par le compteur injecté, PAR INVOCATEUR
 * ET PAR GUILDE : la clé combine `guildId` et `user.id`.
 */
import type { ChatInputCommandInteraction } from "discord.js";
import type { CompteurFenetre } from "../limitation/compteur-fenetre";

/** Clé de cooldown : un invocateur donné, sur une guilde donnée. */
function cleCooldown(interaction: ChatInputCommandInteraction): string {
  return `${interaction.guildId ?? "?"}:${interaction.user.id}`;
}

/**
 * Consomme ATOMIQUEMENT un jeton si l'invocateur n'est pas en cooldown : renvoie `null`
 * (il peut renommer, le jeton vient d'être pris) ; sinon renvoie le message d'attente
 * éphémère SANS rien consommer.
 *
 * L'atomicité `evaluer` PUIS `enregistrer` — sans aucun `await` entre les deux — est ce qui
 * ferme la faille TOCTOU : discord.js dispatche les interactions sans sérialisation, mais la
 * boucle mono-thread garantit qu'aucune autre invocation ne s'intercale entre le check et la
 * prise du jeton. Même patron que le budget d'auto-rename (events/guild-member-update).
 *
 * Compromis assumé (aligné sur le budget B2) : le jeton est pris AU CHECK, donc un renommage
 * qui échoue ensuite (hiérarchie, Forbidden bot) décompte quand même. Coût négligeable (3/60 s)
 * et cohérent avec l'intention anti mass-rename. C'est ce compromis, et pas le contraire, qui
 * garde le contrôle infranchissable sous rafale.
 */
export function consommerCooldownOuMessage(
  cooldown: CompteurFenetre,
  interaction: ChatInputCommandInteraction,
): string | null {
  const cle = cleCooldown(interaction);
  const resultat = cooldown.evaluer(cle);
  if (!resultat.autorise) {
    const secondes = Math.ceil(resultat.attenteMs / 1000);
    return `⏳ Trop de renommages d’affilée. Réessaie dans ${secondes} s.`;
  }
  cooldown.enregistrer(cle);
  return null;
}
