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
import {
  DiscordAPIError,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
  type Role,
} from "discord.js";
import { evaluerFaisabiliteRename, type RaisonInfaisabilite } from "../domain/faisabilite-rename";
import {
  convertirTexte,
  tronquerPseudo,
  LIMITE_TEXTE_CONVERT,
  type ErreurStylisation,
} from "../domain/stylisation";
import { STYLE_NAMES, type StyleName } from "../domain/styles";
import { fr, type Messages } from "../i18n/catalog";

/** Jeu de messages de cette couche de traduction (socle i18n). */
type MessagesStyliser = Messages["styliser"];

/**
 * Message utilisateur pour chaque erreur metier, dans la locale fournie (defaut FR pour les
 * appelants pas encore migres au socle i18n : anti-regression, cf. catalog.ts). Un seul
 * endroit : un changement de libelle ne touche qu'ici (mandat anti-duplication). Inclut le
 * refus propre « ce texte est déjà stylisé » (ADR-0003, decision 3).
 */
export function messageErreur(
  erreur: ErreurStylisation,
  style?: string,
  messages: MessagesStyliser = fr.styliser,
): string {
  switch (erreur) {
    case "style-inconnu":
      return messages.styleInconnu({ style: style ?? "?" });
    case "rien-a-styliser":
      return messages.rienAStyliser;
    case "texte-trop-long":
      return messages.texteTropLong({ limite: LIMITE_TEXTE_CONVERT });
  }
}

/** Code d'erreur Discord « Missing Permissions » (couvre le refus hierarchie a l'execution). */
const CODE_MISSING_PERMISSIONS = 50013;

/**
 * Traduit un echec de `member.edit` en message utilisateur (audit #7). Avant : `catch {}`
 * aplati rapportait TOUTE erreur (429, reseau, 5xx) comme « pas la permission » et l'avalait
 * sans trace. Ici on LOG toujours l'erreur reelle, et on ne renvoie le message « permission »
 * QUE pour un DiscordAPIError 50013 (Missing Permissions / hierarchie) ; sinon un message
 * generique, pour ne pas diagnostiquer a tort une permission manquante.
 */
function messageEchecEdit(err: unknown, messagePermission: string, messageGenerique: string): string {
  console.error("[styliser] echec de member.edit :", err);
  if (err instanceof DiscordAPIError && err.code === CODE_MISSING_PERMISSIONS) {
    return messagePermission;
  }
  return messageGenerique;
}

/** Vrai si le nom est un style charge (garde de type a la frontiere). */
export function estStyleConnu(nom: string): nom is StyleName {
  return (STYLE_NAMES as readonly string[]).includes(nom);
}

/** Apercu stylise d'un style, DERIVE du domaine (jamais un litteral maintenu a la main). */
export function apercuStyle(style: StyleName, echantillon = "ReNamio"): string {
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
  messages: MessagesStyliser = fr.styliser,
): Promise<ResultatRename> {
  // Hierarchie de roles : le bot ne peut pas editer un membre au-dessus de lui
  // (ou le proprietaire). On le detecte AVANT d'appeler l'API.
  if (!membre.manageable) {
    return {
      ok: false,
      message: messages.hierarchieRenommer,
    };
  }

  const resultat = convertirTexte(source, style);
  if (!resultat.ok) {
    return { ok: false, message: messageErreur(resultat.erreur, style, messages) };
  }

  const pseudo = tronquerPseudo(resultat.texte);

  try {
    await membre.edit({ nick: pseudo });
  } catch (err) {
    return {
      ok: false,
      message: messageEchecEdit(err, messages.permissionRenommer, messages.echecRenommage),
    };
  }

  return { ok: true, pseudo, style };
}

/**
 * Resultat d'une restauration de pseudo (issue #25). Distinct de ResultatRename : on ne
 * stylise PAS, on repose un pseudo memorise tel quel. Etats invalides irrepresentables.
 */
export type ResultatRestauration = { ok: true; pseudo: string } | { ok: false; message: string };

/**
 * Repose un pseudo MEMORISE (round-trip #25) — sans passer par la stylisation. Verifie la
 * hierarchie (comme appliquerRename), tronque a 32 code points par securite, edite le nick.
 * Aucune regle de domaine ici (le pseudo a deja ete valide a la memorisation) ; c'est le
 * pendant « retour » de appliquerRename, partage avec l'evenement guildMemberUpdate.
 */
export async function restaurerPseudo(
  membre: GuildMember,
  pseudo: string,
  messages: MessagesStyliser = fr.styliser,
): Promise<ResultatRestauration> {
  if (!membre.manageable) {
    return {
      ok: false,
      message: messages.hierarchieRestaurer,
    };
  }
  const tronque = tronquerPseudo(pseudo);
  try {
    await membre.edit({ nick: tronque });
  } catch (err) {
    return {
      ok: false,
      message: messageEchecEdit(err, messages.permissionRestaurer, messages.echecRestauration),
    };
  }
  return { ok: true, pseudo: tronque };
}

/**
 * Champs d'un embed de confirmation de rename (membre / style / pseudo). Source UNIQUE
 * partagee par `embedRenameOk` (couleur fixe : /rename, /random) et par le menu contextuel
 * « Styliser » (embed THEME via la fabrique) — regle de 3, anti-duplication.
 */
export function champsRename(
  membre: GuildMember,
  pseudo: string,
  style: StyleName,
  messages: MessagesStyliser = fr.styliser,
): { name: string; value: string; inline: boolean }[] {
  return [
    { name: messages.champMembre, value: membre.toString(), inline: true },
    { name: messages.champStyle, value: capitaliser(style), inline: true },
    { name: messages.champNouveauPseudo, value: pseudo, inline: false },
  ];
}

/** Embed de confirmation d'un rename (couleur configurable : vert /rename, violet /random). */
export function embedRenameOk(
  membre: GuildMember,
  pseudo: string,
  style: StyleName,
  couleur: number,
  titre: string,
  messages: MessagesStyliser = fr.styliser,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(titre)
    .setColor(couleur)
    .addFields(...champsRename(membre, pseudo, style, messages));
}

/** Source du rename : nouveau_nom explicite, sinon nick serveur, sinon nom global. */
export function sourceRename(membre: GuildMember, nouveauNom: string | null): string {
  return nouveauNom ?? membre.nickname ?? membre.user.username;
}

/** Capitalise la 1re lettre (affichage du nom de style dans les embeds). */
export function capitaliser(mot: string): string {
  return mot.length > 0 ? mot[0]!.toUpperCase() + mot.slice(1) : mot;
}

/** Message d'alerte pour chaque raison d'infaisabilite d'un auto-rename (#29). */
function messageInfaisabilite(raison: RaisonInfaisabilite, messages: MessagesStyliser): string {
  switch (raison) {
    case "permission-manquante":
      return messages.faisabilitePermissionManquante;
    case "role-trop-haut":
      return messages.faisabiliteRoleTropHaut;
  }
}

/**
 * Alerte de faisabilite d'un auto-rename pour un role (#29). Extrait les primitives
 * (permission du bot, positions de role) et delegue au predicat PUR du domaine. Le
 * mapping n'est PAS bloque : on renvoie juste un message d'alerte a afficher, ou
 * `null` si le bot pourra renommer. `botMembre`/`role` nuls -> pas d'alerte (on ne
 * sait pas, on ne crie pas a tort).
 */
export function avertissementFaisabilite(
  botMembre: GuildMember | null,
  role: Pick<Role, "position"> | null,
  messages: MessagesStyliser = fr.styliser,
): string | null {
  if (!botMembre || !role) return null;
  const faisabilite = evaluerFaisabiliteRename({
    botPeutGererPseudos: botMembre.permissions.has(PermissionFlagsBits.ManageNicknames),
    positionRoleBot: botMembre.roles.highest.position,
    positionRoleCible: role.position,
  });
  return faisabilite.ok ? null : messageInfaisabilite(faisabilite.raison, messages);
}
