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
    /** Description de la commande /convert (localisee sur Discord). */
    commandeDescription: string;
    texteOptionDescription: string;
    styleOptionDescription: string;
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
  /**
   * Couche de traduction PARTAGEE (ACL) entre le domaine de stylisation et Discord, consommee
   * par /rename, /random, /convert, /preview, l'auto-rename et les menus contextuels. Un seul
   * point de verite pour ces messages (regle de 3 : au moins 5 commandes les partagent).
   */
  styliser: {
    styleInconnu: (p: { style: string }) => string;
    rienAStyliser: string;
    texteTropLong: (p: { limite: number }) => string;
    hierarchieRenommer: string;
    permissionRenommer: string;
    echecRenommage: string;
    hierarchieRestaurer: string;
    permissionRestaurer: string;
    echecRestauration: string;
    champMembre: string;
    champStyle: string;
    champNouveauPseudo: string;
    faisabilitePermissionManquante: string;
    faisabiliteRoleTropHaut: string;
  };
  /** Cooldown anti mass-rename PARTAGE par /rename et /random. */
  cooldown: {
    tropDeRenommages: (p: { secondes: number }) => string;
  };
  rename: {
    commandeDescription: string;
    membreOptionDescription: string;
    styleOptionDescription: string;
    nouveauNomOptionDescription: string;
    dureeOptionDescription: string;
    dureeInvalide: string;
    titreConfirmation: string;
  };
  random: {
    commandeDescription: string;
    titreConfirmation: string;
  };
  renameCancel: {
    commandeDescription: string;
    membreOptionDescription: string;
    aucunRenommageTemporaire: string;
    confirmation: (p: { membre: string; pseudo: string }) => string;
  };
  renamePending: {
    commandeDescription: string;
    horsServeur: string;
    aucuneEcheance: string;
    entete: (p: { count: number }) => string;
    reste: (p: { reste: number }) => string;
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
    commandeDescription: "Convertit un texte dans un style Unicode.",
    texteOptionDescription: "Le texte à convertir",
    styleOptionDescription: "Le style de police à appliquer",
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
  styliser: {
    styleInconnu: ({ style }) =>
      `❌ Style « ${style} » inconnu. Utilise \`/styles\` pour voir la liste.`,
    rienAStyliser: "❌ Rien à styliser : ce texte est déjà stylisé (ou ne contient aucune lettre).",
    texteTropLong: ({ limite }) => `❌ Texte trop long : ${limite} caractères maximum.`,
    hierarchieRenommer:
      "❌ Hiérarchie de rôles : je ne peux pas renommer ce membre (rôle trop haut).",
    permissionRenommer: "❌ Je n’ai pas la permission de renommer ce membre.",
    echecRenommage: "❌ Le renommage a échoué (erreur Discord). Réessaie dans un moment.",
    hierarchieRestaurer:
      "❌ Hiérarchie de rôles : je ne peux pas restaurer le pseudo de ce membre.",
    permissionRestaurer: "❌ Je n’ai pas la permission de restaurer ce pseudo.",
    echecRestauration:
      "❌ La restauration du pseudo a échoué (erreur Discord). Réessaie dans un moment.",
    champMembre: "👤 Membre",
    champStyle: "🎨 Style",
    champNouveauPseudo: "📝 Nouveau pseudo",
    faisabilitePermissionManquante:
      "⚠️ Attention : il me manque la permission « Gérer les pseudos », je ne pourrai pas appliquer ce style.",
    faisabiliteRoleTropHaut:
      "⚠️ Attention : ce rôle est au-dessus du mien, je ne pourrai pas renommer ses membres. Place mon rôle plus haut.",
  },
  cooldown: {
    tropDeRenommages: ({ secondes }) =>
      `⏳ Trop de renommages d’affilée. Réessaie dans ${secondes} s.`,
  },
  rename: {
    commandeDescription: "Renomme un membre avec un style.",
    membreOptionDescription: "Le membre à renommer",
    styleOptionDescription: "Le style à appliquer",
    nouveauNomOptionDescription: "Nouveau nom (optionnel ; sinon nom actuel)",
    dureeOptionDescription: "Auto-revert après ce délai (ex. 2h, 30m, 7j) ou à une date ISO",
    dureeInvalide:
      "❌ Durée invalide. Utilise une durée comme `2h`, `30m`, `7j`, ou une date ISO future.",
    titreConfirmation: "✅ Membre renommé",
  },
  random: {
    commandeDescription: "Renomme un membre avec un style aléatoire.",
    titreConfirmation: "🎲 Membre renommé (aléatoire)",
  },
  renameCancel: {
    commandeDescription: "Annule un renommage temporaire et restaure le pseudo d’origine.",
    membreOptionDescription: "Le membre dont annuler le renommage",
    aucunRenommageTemporaire: "ℹ️ Ce membre n’a aucun renommage temporaire actif.",
    confirmation: ({ membre, pseudo }) =>
      `✅ Renommage temporaire de ${membre} annulé, pseudo restauré : **${pseudo}**.`,
  },
  renamePending: {
    commandeDescription: "Liste les renommages temporaires à venir sur ce serveur.",
    horsServeur: "❌ Cette commande doit être utilisée sur un serveur.",
    aucuneEcheance: "ℹ️ Aucun renommage temporaire en attente sur ce serveur.",
    entete: ({ count }) => `⏳ **Renommages temporaires en attente (${count})**`,
    reste: ({ reste }) => `… et ${reste} autre(s) échéance(s) non affichée(s).`,
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
    commandeDescription: "Converts a text into a Unicode style.",
    texteOptionDescription: "The text to convert",
    styleOptionDescription: "The font style to apply",
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
  styliser: {
    styleInconnu: ({ style }) => `❌ Unknown style "${style}". Use \`/styles\` to see the list.`,
    rienAStyliser: "❌ Nothing to stylize: this text is already stylized (or has no letters).",
    texteTropLong: ({ limite }) => `❌ Text too long: ${limite} characters maximum.`,
    hierarchieRenommer: "❌ Role hierarchy: I can't rename this member (role too high).",
    permissionRenommer: "❌ I don't have permission to rename this member.",
    echecRenommage: "❌ The rename failed (Discord error). Try again in a moment.",
    hierarchieRestaurer: "❌ Role hierarchy: I can't restore this member's nickname.",
    permissionRestaurer: "❌ I don't have permission to restore this nickname.",
    echecRestauration: "❌ Restoring the nickname failed (Discord error). Try again in a moment.",
    champMembre: "👤 Member",
    champStyle: "🎨 Style",
    champNouveauPseudo: "📝 New nickname",
    faisabilitePermissionManquante:
      "⚠️ Heads up: I'm missing the \"Manage Nicknames\" permission, so I won't be able to apply this style.",
    faisabiliteRoleTropHaut:
      "⚠️ Heads up: this role is above mine, so I won't be able to rename its members. Move my role higher.",
  },
  cooldown: {
    tropDeRenommages: ({ secondes }) => `⏳ Too many renames in a row. Try again in ${secondes}s.`,
  },
  rename: {
    commandeDescription: "Renames a member with a style.",
    membreOptionDescription: "The member to rename",
    styleOptionDescription: "The style to apply",
    nouveauNomOptionDescription: "New name (optional; defaults to the current name)",
    dureeOptionDescription: "Auto-revert after this delay (e.g. 2h, 30m, 7j) or an ISO date",
    dureeInvalide:
      "❌ Invalid duration. Use a duration like `2h`, `30m`, `7j`, or a future ISO date.",
    titreConfirmation: "✅ Member renamed",
  },
  random: {
    commandeDescription: "Renames a member with a random style.",
    titreConfirmation: "🎲 Member renamed (random)",
  },
  renameCancel: {
    commandeDescription: "Cancels a temporary rename and restores the original nickname.",
    membreOptionDescription: "The member whose rename to cancel",
    aucunRenommageTemporaire: "ℹ️ This member has no active temporary rename.",
    confirmation: ({ membre, pseudo }) =>
      `✅ Temporary rename of ${membre} cancelled, nickname restored: **${pseudo}**.`,
  },
  renamePending: {
    commandeDescription: "Lists the upcoming temporary renames on this server.",
    horsServeur: "❌ This command can only be used in a server.",
    aucuneEcheance: "ℹ️ No temporary rename is pending on this server.",
    entete: ({ count }) => `⏳ **Pending temporary renames (${count})**`,
    reste: ({ reste }) => `… and ${reste} more deadline(s) not shown.`,
  },
  erreurGenerique: "An error occurred.",
};

export const CATALOGUE: Record<LocaleTag, Messages> = { fr, en };
