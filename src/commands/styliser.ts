/**
 * Couche de TRADUCTION (anti-corruption) entre le domaine de stylisation pur
 * (src/domain) et Discord.js. Centralise :
 *   - le message utilisateur de chaque erreur metier (ErreurStylisation) ;
 *   - l'apercu d'un style (derive du domaine, pas d'un litteral UI) ;
 *   - le flux de rename partage par /rename et /random.
 *
 * C'est ici que le modele Discord rencontre le domaine, et nulle part ailleurs :
 * les commandes extraient les primitives (texte, nom de style), appellent le
 * domaine, et reposent le resultat via ces helpers. Le domaine reste sans mock
 * et sans import de discord.js (invariant de l'ACL ciblee, ADR-0002).
 */
import { EmbedBuilder, type GuildMember } from 'discord.js';
import { convertirTexte, tronquerPseudo, type ErreurStylisation } from '../domain/stylisation';
import { STYLE_NAMES, type StyleName } from '../domain/styles';

/**
 * Message utilisateur (FR) pour chaque erreur metier. Un seul endroit : un
 * changement de libelle ne touche qu'ici (mandat anti-duplication). Inclut le
 * refus propre « ce texte est déjà stylisé » (ADR-0003, decision 3).
 */
export function messageErreur(erreur: ErreurStylisation, style?: string): string {
  switch (erreur) {
    case 'style-inconnu':
      return `❌ Style « ${style ?? '?'} » inconnu. Utilise \`/styles\` pour voir la liste.`;
    case 'rien-a-styliser':
      return '❌ Rien à styliser : ce texte est déjà stylisé (ou ne contient aucune lettre).';
  }
}

/** Vrai si le nom est un style charge (garde de type a la frontiere). */
export function estStyleConnu(nom: string): nom is StyleName {
  return (STYLE_NAMES as readonly string[]).includes(nom);
}

/** Apercu stylise d'un style, DERIVE du domaine (jamais un litteral maintenu a la main). */
export function apercuStyle(style: StyleName, echantillon = 'ReNamio'): string {
  const r = convertirTexte(echantillon, style);
  return r.ok ? r.texte : echantillon;
}

/**
 * Resultat du flux de rename, pour que l'appelant (commande) decide de la reponse
 * Discord. Etats invalides irrepresentables : soit un succes avec le pseudo ecrit,
 * soit une erreur portant le message utilisateur deja pret.
 */
export type ResultatRename =
  | { ok: true; pseudo: string; style: StyleName }
  | { ok: false; message: string };

/**
 * Flux de rename PARTAGE par /rename et /random (regle de 3 : rename + random +
 * futur auto-rename B6). Verifie la hierarchie, stylise via le domaine, tronque
 * a 32 code points, edite le nick. La permission de l'APPELANT et le choix du
 * style sont a la charge de la commande appelante.
 */
export async function appliquerRename(
  membre: GuildMember,
  style: StyleName,
  source: string,
): Promise<ResultatRename> {
  // Hierarchie de roles : le bot ne peut pas editer un membre au-dessus de lui
  // (ou le proprietaire). On le detecte AVANT d'appeler l'API.
  if (!membre.manageable) {
    return {
      ok: false,
      message: '❌ Hiérarchie de rôles : je ne peux pas renommer ce membre (rôle trop haut).',
    };
  }

  const resultat = convertirTexte(source, style);
  if (!resultat.ok) {
    return { ok: false, message: messageErreur(resultat.erreur, style) };
  }

  const pseudo = tronquerPseudo(resultat.texte);

  try {
    await membre.edit({ nick: pseudo });
  } catch {
    // discord.Forbidden cote bot (permission Discord manquante a l'execution).
    return { ok: false, message: '❌ Je n’ai pas la permission de renommer ce membre.' };
  }

  return { ok: true, pseudo, style };
}

/** Embed de confirmation d'un rename (couleur configurable : vert /rename, violet /random). */
export function embedRenameOk(
  membre: GuildMember,
  pseudo: string,
  style: StyleName,
  couleur: number,
  titre: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(titre)
    .setColor(couleur)
    .addFields(
      { name: '👤 Membre', value: membre.toString(), inline: true },
      { name: '🎨 Style', value: capitaliser(style), inline: true },
      { name: '📝 Nouveau pseudo', value: pseudo, inline: false },
    );
}

/** Source du rename : nouveau_nom explicite, sinon nick serveur, sinon nom global. */
export function sourceRename(membre: GuildMember, nouveauNom: string | null): string {
  return nouveauNom ?? membre.nickname ?? membre.user.username;
}

/** Capitalise la 1re lettre (affichage du nom de style dans les embeds). */
export function capitaliser(mot: string): string {
  return mot.length > 0 ? mot[0]!.toUpperCase() + mot.slice(1) : mot;
}
