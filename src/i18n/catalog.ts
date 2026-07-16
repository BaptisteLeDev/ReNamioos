/**
 * Catalogue i18n a TYPAGE FORT (socle de flotte). Les messages parametriques sont des
 * FONCTIONS -> l'acces est une lecture de propriete native : une cle absente est une
 * erreur de COMPILATION, jamais un miss runtime (pas de dot-path `t("a.b")`).
 *
 * `en: Messages` force le catalogue anglais a porter TOUTES les cles de FR (derive
 * anti-drift). FR est la reference remplie de ReNamioos (bot FR-lourd) ; EN est une
 * traduction de base, coherente et complete, a etendre au fil de l'extraction i18n
 * (couverture complete de toutes les chaines = tache separee).
 */
import type { LocaleTag } from "../domain/locale";

export interface Messages {
  config: {
    /** Description de la commande /config (localisee sur Discord). */
    commandeDescription: string;
    langue: {
      sousCommandeDescription: string;
      optionDescription: string;
      definie: (p: { locale: string }) => string;
      invalide: string;
    };
    couleur: {
      sousCommandeDescription: string;
      optionDescription: string;
      definie: (p: { couleur: string }) => string;
      reinitialisee: string;
      invalide: string;
    };
    afficher: {
      sousCommandeDescription: string;
      titre: string;
      champLangue: string;
      champCouleur: string;
      valeurDefaut: string;
    };
    permissionRefusee: string;
    horsServeur: string;
  };
  convert: {
    titre: (p: { style: string }) => string;
    champOriginal: string;
    champResultat: string;
  };
  menuContextuel: {
    /** Nom de la commande contextuelle message (localise cote Discord). */
    convertirNom: string;
    /** Nom de la commande contextuelle membre (localise cote Discord). */
    styliserNom: string;
    /** Placeholder du select de choix de style. */
    selectStyle: string;
    convertirVide: string;
    convertirIntrouvable: string;
    convertirTronque: (p: { limite: number }) => string;
    styliserTitre: string;
    styliserApplique: string;
    styliserPermissionRefusee: string;
    styliserMembreIntrouvable: string;
    styliserExpire: string;
    horsServeur: string;
  };
  event: {
    commandeDescription: string;
    startDescription: string;
    styleOption: string;
    dureeOption: string;
    roleOption: string;
    stopDescription: string;
    statusDescription: string;
    dejaEnCours: string;
    dureeInvalide: string;
    annonceTitre: string;
    annonceDescription: (p: { style: string; roleId: string; fin: string }) => string;
    resume: (p: { stylises: number; ignores: number; echecs: number }) => string;
    arrete: (p: { reverts: number }) => string;
    aucunEvent: string;
    statutTitre: string;
    statut: (p: { style: string; roleId: string; fin: string }) => string;
  };
  erreurGenerique: string;
}

export const fr: Messages = {
  config: {
    commandeDescription: "Personnalise le bot pour ce serveur (langue, couleur).",
    langue: {
      sousCommandeDescription: "Definit la langue du bot sur ce serveur.",
      optionDescription: "Langue a utiliser.",
      definie: ({ locale }) => `Langue definie sur \`${locale}\`.`,
      invalide: "Langue invalide. Choisis une langue proposee dans la liste.",
    },
    couleur: {
      sousCommandeDescription: "Definit la couleur des embeds (hex, ou `reset`).",
      optionDescription:
        "Couleur hexadecimale (ex. #5865F2), ou `reset` pour la couleur par defaut.",
      definie: ({ couleur }) => `Couleur des embeds definie sur \`${couleur}\`.`,
      reinitialisee: "Couleur des embeds reinitialisee sur la couleur par defaut.",
      invalide: "Couleur invalide. Utilise un hex comme `#5865F2`, ou `reset`.",
    },
    afficher: {
      sousCommandeDescription: "Affiche la configuration actuelle du serveur.",
      titre: "Configuration du serveur",
      champLangue: "Langue",
      champCouleur: "Couleur des embeds",
      valeurDefaut: "(par defaut)",
    },
    permissionRefusee:
      "Tu dois avoir la permission Gerer le serveur pour utiliser cette commande.",
    horsServeur: "Cette commande ne peut etre utilisee que sur un serveur.",
  },
  convert: {
    titre: ({ style }) => `✨ Conversion en ${style}`,
    champOriginal: "📝 Original",
    champResultat: "🎨 Resultat",
  },
  menuContextuel: {
    convertirNom: "Convertir en stylisé",
    styliserNom: "Styliser",
    selectStyle: "Choisis un style",
    convertirVide: "❌ Ce message ne contient aucun texte à convertir.",
    convertirIntrouvable: "❌ Message introuvable (supprimé ?). Relance la conversion.",
    convertirTronque: ({ limite }) => `✂️ Texte tronqué à ${limite} caractères.`,
    styliserTitre: "🎨 Styliser un membre",
    styliserApplique: "✅ Membre stylisé",
    styliserPermissionRefusee: "❌ Tu n’as pas la permission de gérer les surnoms.",
    styliserMembreIntrouvable: "❌ Membre introuvable sur ce serveur.",
    styliserExpire: "⏳ Ce menu a expiré. Refais un clic droit → Styliser.",
    horsServeur: "❌ Cette action s’utilise sur un serveur.",
  },
  event: {
    commandeDescription: "Programme un événement stylisé (Style Party) sur ce serveur.",
    startDescription: "Démarre une Style Party : stylise les membres d’un rôle pour une durée.",
    styleOption: "Le style à appliquer pendant l’événement",
    dureeOption: "Durée (ex. 2h, 30m, 7j) ou date ISO de fin",
    roleOption: "Le rôle dont les membres seront stylisés",
    stopDescription: "Arrête la Style Party en cours et restaure les pseudos.",
    statusDescription: "Affiche la Style Party en cours, s’il y en a une.",
    dejaEnCours: "❌ Une Style Party est déjà en cours. Arrête-la d’abord avec `/event stop`.",
    dureeInvalide: "❌ Durée invalide. Utilise `2h`, `30m`, `7j`, ou une date ISO future.",
    annonceTitre: "🎉 Style Party lancée !",
    annonceDescription: ({ style, roleId, fin }) =>
      `Les membres de <@&${roleId}> passent en **${style}** jusqu’à ${fin}.`,
    resume: ({ stylises, ignores, echecs }) =>
      `✨ ${stylises} stylisé(s) · ${ignores} ignoré(s) · ${echecs} échec(s).`,
    arrete: ({ reverts }) => `🛑 Style Party arrêtée. ${reverts} pseudo(s) restauré(s).`,
    aucunEvent: "Aucune Style Party en cours sur ce serveur.",
    statutTitre: "🎉 Style Party en cours",
    statut: ({ style, roleId, fin }) =>
      `Style **${style}** sur <@&${roleId}> — fin ${fin}.`,
  },
  erreurGenerique: "Une erreur est survenue.",
};

export const en: Messages = {
  config: {
    commandeDescription: "Customize the bot for this server (language, color).",
    langue: {
      sousCommandeDescription: "Set the bot language for this server.",
      optionDescription: "Language to use.",
      definie: ({ locale }) => `Language set to \`${locale}\`.`,
      invalide: "Invalid language. Pick one of the languages offered in the list.",
    },
    couleur: {
      sousCommandeDescription: "Set the embed color (hex, or `reset`).",
      optionDescription: "Hex color (e.g. #5865F2), or `reset` for the default color.",
      definie: ({ couleur }) => `Embed color set to \`${couleur}\`.`,
      reinitialisee: "Embed color reset to the default color.",
      invalide: "Invalid color. Use a hex like `#5865F2`, or `reset`.",
    },
    afficher: {
      sousCommandeDescription: "Show the current server configuration.",
      titre: "Server configuration",
      champLangue: "Language",
      champCouleur: "Embed color",
      valeurDefaut: "(default)",
    },
    permissionRefusee: "You need the Manage Server permission to use this command.",
    horsServeur: "This command can only be used in a server.",
  },
  convert: {
    titre: ({ style }) => `✨ Converted to ${style}`,
    champOriginal: "📝 Original",
    champResultat: "🎨 Result",
  },
  menuContextuel: {
    convertirNom: "Convert to styled",
    styliserNom: "Stylize",
    selectStyle: "Pick a style",
    convertirVide: "❌ This message has no text to convert.",
    convertirIntrouvable: "❌ Message not found (deleted?). Start the conversion again.",
    convertirTronque: ({ limite }) => `✂️ Text truncated to ${limite} characters.`,
    styliserTitre: "🎨 Stylize a member",
    styliserApplique: "✅ Member stylized",
    styliserPermissionRefusee: "❌ You don’t have permission to manage nicknames.",
    styliserMembreIntrouvable: "❌ Member not found in this server.",
    styliserExpire: "⏳ This menu has expired. Right-click → Stylize again.",
    horsServeur: "❌ This action can only be used in a server.",
  },
  event: {
    commandeDescription: "Schedule a styled event (Style Party) on this server.",
    startDescription: "Start a Style Party: stylize a role’s members for a set duration.",
    styleOption: "The style to apply during the event",
    dureeOption: "Duration (e.g. 2h, 30m, 7j) or an ISO end date",
    roleOption: "The role whose members will be stylized",
    stopDescription: "Stop the ongoing Style Party and restore nicknames.",
    statusDescription: "Show the ongoing Style Party, if any.",
    dejaEnCours: "❌ A Style Party is already running. Stop it first with `/event stop`.",
    dureeInvalide: "❌ Invalid duration. Use `2h`, `30m`, `7j`, or a future ISO date.",
    annonceTitre: "🎉 Style Party started!",
    annonceDescription: ({ style, roleId, fin }) =>
      `Members of <@&${roleId}> switch to **${style}** until ${fin}.`,
    resume: ({ stylises, ignores, echecs }) =>
      `✨ ${stylises} stylized · ${ignores} skipped · ${echecs} failed.`,
    arrete: ({ reverts }) => `🛑 Style Party stopped. ${reverts} nickname(s) restored.`,
    aucunEvent: "No Style Party is running on this server.",
    statutTitre: "🎉 Style Party in progress",
    statut: ({ style, roleId, fin }) =>
      `Style **${style}** on <@&${roleId}> — ends ${fin}.`,
  },
  erreurGenerique: "An error occurred.",
};

export const CATALOGUE: Record<LocaleTag, Messages> = { fr, en };
