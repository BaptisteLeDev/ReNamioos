/**
 * Registre des commandes slash. Toute nouvelle commande s'ajoute ici.
 *
 * Fabrique : la plupart des commandes sont des objets statiques, mais /aide et
 * /auto-rename dependent de la PROVENANCE de la config auto-rename. Depuis B8
 * (ADR-0005) celle-ci est le port MappingStore (Neon par serveur, ou fichier en
 * dev), injecte a la composition (src/client.ts). On expose donc une fabrique qui
 * recoit le store ; le deploiement des slash (deploy-commands.ts) passe un store
 * fichier vide (suffisant pour produire le SCHEMA des commandes).
 *
 * /update (admin) re-synchronise les commandes sur le serveur courant et detecte les
 * nouvelles depuis la derniere synchro : elle recoit le CommandSyncStore (provenance
 * des commandes connues par serveur) + une fonction de re-deploiement REST (I/O isolee).
 * Elle DERIVE sa liste du registre via une reference paresseuse (commandsRef), pour
 * s'inclure elle-meme sans cycle a la construction.
 */
import { creerAideCommand } from "./aide";
import { creerAutoRenameCommand } from "./auto-rename";
import { creerRenamioosCommand } from "./renamioos";
import { creerConvertCommand } from "./convert";
import { creerConfigCommand } from "./config";
import { pingCommand } from "./ping";
import { previewCommand } from "./preview";
import { creerRandomCommand } from "./random";
import { creerRenameCommand } from "./rename";
import { creerRenamePendingCommand } from "./rename-pending";
import { creerRenameCancelCommand } from "./rename-cancel";
import { creerCompteurFenetre, type CompteurFenetre } from "../limitation/compteur-fenetre";
import { FENETRE_RENOMMAGE_MS, LIMITE_RENOMMAGE_PAR_INVOCATEUR } from "../domain/fenetre-glissante";
import { stylesCommand } from "./styles";
import { creerUpdateCommand } from "./update";
import type { Command } from "./types";
import type { MappingStore } from "../mapping/store";
import type { OptOutStore } from "../optout/store";
import type { AutoRenameLogStore } from "../auto-rename-log/store";
import type { CommandSyncStore } from "../command-sync/store";
import type { OriginalNickStore } from "../original-nick/store";
import type { GuildSettingsStore } from "../guildsettings/store";
import type { EmbedTheme } from "../theming/embed";
import type { RESTPostAPIApplicationCommandsJSONBody } from "discord.js";

export interface OptionsCommandes {
  mappingStore: MappingStore;
  /** Provenance du consentement membre a l'auto-rename (issue #27). */
  optOutStore: OptOutStore;
  /** Provenance du journal d'auto-rename (issue #28), lu par /auto-rename log. */
  autoRenameLogStore: AutoRenameLogStore;
  commandSyncStore: CommandSyncStore;
  /** Provenance du pseudo d'origine + echeance (#25/#38), pour /rename ... duree:. */
  originalNickStore: OriginalNickStore;
  /** Provenance des reglages par serveur (socle : langue + couleur), pour /config et /convert. */
  settingsStore: GuildSettingsStore;
  /** Fabrique d'embeds themee (socle) : couleur du theme ou override de la guilde. */
  embedFactory: EmbedTheme;
  /** PUT REST des commandes sur la guild courante (I/O Discord isolee). */
  redeploy(guildId: string, payload: RESTPostAPIApplicationCommandsJSONBody[]): Promise<void>;
  /**
   * Cooldown anti mass-rename PARTAGÉ par /rename et /random (B1). Une seule instance
   * pour que la limite de 3 renommages/60 s couvre les deux commandes par invocateur/guilde.
   * Défaut : compteur mémoire neuf (utile en test/deploy-commands).
   */
  cooldownRename?: CompteurFenetre;
}

export function creerCommandes(options: OptionsCommandes): Command[] {
  const {
    mappingStore,
    optOutStore,
    autoRenameLogStore,
    commandSyncStore,
    originalNickStore,
    settingsStore,
    embedFactory,
    redeploy,
  } = options;

  // Cooldown PARTAGÉ /rename + /random (B1) : une seule instance couvre les deux commandes.
  const cooldownRename =
    options.cooldownRename ??
    creerCompteurFenetre({
      limite: LIMITE_RENOMMAGE_PAR_INVOCATEUR,
      fenetreMs: FENETRE_RENOMMAGE_MS,
    });

  const commandes: Command[] = [
    pingCommand,
    stylesCommand,
    creerConvertCommand(settingsStore, embedFactory),
    previewCommand,
    creerRenameCommand(originalNickStore, cooldownRename),
    creerRenamePendingCommand(originalNickStore),
    creerRenameCancelCommand(originalNickStore),
    creerRandomCommand(cooldownRename),
    creerAutoRenameCommand(mappingStore, autoRenameLogStore),
    creerRenamioosCommand(optOutStore),
    creerAideCommand(mappingStore),
    creerConfigCommand(settingsStore, embedFactory),
  ];

  commandes.push(
    creerUpdateCommand({
      store: commandSyncStore,
      redeploy,
      commandsRef: () => commandes,
    }),
  );

  return commandes;
}
