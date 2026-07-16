/**
 * Commande /config (socle) : personnalisation du bot PAR SERVEUR (langue, couleur).
 *
 * Securite en profondeur : `setDefaultMemberPermissions(ManageGuild)` cache la commande
 * aux non-admins cote Discord, ET `execute` REVALIDE la permission (un client modifie ou
 * une mauvaise config de roles ne doit pas contourner le controle). Reponses ephemeres : la
 * config n'a pas a polluer le salon. Validation par VO (parseLocale/parseEmbedColor).
 *
 * ADAPTER : traduit l'interaction vers le port (settingsStore) et les VO du domaine ; ne
 * porte aucune regle metier propre. Consomme le socle via `resoudreContexteCommande`
 * (locale effective + messages) et la fabrique d'embeds themee (afficher).
 */
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { parseLocale, LOCALES } from "../domain/locale";
import { parseEmbedColor } from "../domain/embed-color";
import { CATALOGUE, type Messages } from "../i18n/catalog";
import { localisations } from "../i18n/localizations";
import { resoudreContexteCommande } from "./contexte";
import type { Command } from "./types";
import type { GuildSettingsStore } from "../guildsettings/store";
import type { EmbedTheme } from "../theming/embed";

const SOUS_LANGUE = "langue";
const SOUS_COULEUR = "couleur";
const SOUS_AFFICHER = "afficher";
const OPTION_LANGUE = "langue";
const OPTION_VALEUR = "valeur";
const RESET = "reset";

/** Descripteur de la commande : nom stable (non localise), descriptions localisees. */
function construireData(): SlashCommandBuilder {
  const m = CATALOGUE.fr;
  const builder = new SlashCommandBuilder()
    .setName("config")
    .setDescription(m.config.commandeDescription)
    .setDescriptionLocalizations(localisations((x) => x.config.commandeDescription))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

  builder.addSubcommand((sc) =>
    sc
      .setName(SOUS_LANGUE)
      .setDescription(m.config.langue.sousCommandeDescription)
      .setDescriptionLocalizations(localisations((x) => x.config.langue.sousCommandeDescription))
      .addStringOption((opt) =>
        opt
          .setName(OPTION_LANGUE)
          .setDescription(m.config.langue.optionDescription)
          .setDescriptionLocalizations(localisations((x) => x.config.langue.optionDescription))
          .setRequired(true)
          .addChoices(...LOCALES.map((l) => ({ name: l, value: l }))),
      ),
  );

  builder.addSubcommand((sc) =>
    sc
      .setName(SOUS_COULEUR)
      .setDescription(m.config.couleur.sousCommandeDescription)
      .setDescriptionLocalizations(localisations((x) => x.config.couleur.sousCommandeDescription))
      .addStringOption((opt) =>
        opt
          .setName(OPTION_VALEUR)
          .setDescription(m.config.couleur.optionDescription)
          .setDescriptionLocalizations(localisations((x) => x.config.couleur.optionDescription))
          .setRequired(true),
      ),
  );

  builder.addSubcommand((sc) =>
    sc
      .setName(SOUS_AFFICHER)
      .setDescription(m.config.afficher.sousCommandeDescription)
      .setDescriptionLocalizations(localisations((x) => x.config.afficher.sousCommandeDescription)),
  );

  return builder;
}

export function creerConfigCommand(
  settingsStore: GuildSettingsStore,
  embedFactory: EmbedTheme,
): Command {
  return {
    data: construireData(),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const { messages } = await resoudreContexteCommande(interaction, settingsStore);

      const guildId = interaction.guildId;
      if (guildId === null) {
        await interaction.reply({ content: messages.config.horsServeur, ephemeral: true });
        return;
      }
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: messages.config.permissionRefusee, ephemeral: true });
        return;
      }

      const sousCommande = interaction.options.getSubcommand();
      if (sousCommande === SOUS_LANGUE) {
        await executerLangue(interaction, guildId, messages, settingsStore);
        return;
      }
      if (sousCommande === SOUS_COULEUR) {
        await executerCouleur(interaction, guildId, messages, settingsStore);
        return;
      }
      await executerAfficher(interaction, guildId, messages, settingsStore, embedFactory);
    },
  };
}

async function executerLangue(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  messages: Messages,
  store: GuildSettingsStore,
): Promise<void> {
  const valeur = interaction.options.getString(OPTION_LANGUE, true);
  const locale = parseLocale(valeur);
  if (locale === null) {
    await interaction.reply({ content: messages.config.langue.invalide, ephemeral: true });
    return;
  }
  await store.setLocale(guildId, locale);
  await interaction.reply({
    content: messages.config.langue.definie({ locale }),
    ephemeral: true,
  });
}

async function executerCouleur(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  messages: Messages,
  store: GuildSettingsStore,
): Promise<void> {
  const valeur = interaction.options.getString(OPTION_VALEUR, true).trim();
  if (valeur.toLowerCase() === RESET) {
    await store.setEmbedColor(guildId, null);
    await interaction.reply({ content: messages.config.couleur.reinitialisee, ephemeral: true });
    return;
  }
  const couleur = parseEmbedColor(valeur);
  if (couleur === null) {
    await interaction.reply({ content: messages.config.couleur.invalide, ephemeral: true });
    return;
  }
  await store.setEmbedColor(guildId, couleur);
  await interaction.reply({
    content: messages.config.couleur.definie({ couleur: valeur }),
    ephemeral: true,
  });
}

async function executerAfficher(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  messages: Messages,
  store: GuildSettingsStore,
  embedFactory: EmbedTheme,
): Promise<void> {
  const settings = await store.get(guildId);
  const embed = embedFactory({ couleurGuilde: settings.embedColor })
    .setTitle(messages.config.afficher.titre)
    .addFields(
      {
        name: messages.config.afficher.champLangue,
        value: settings.preferredLocale ?? messages.config.afficher.valeurDefaut,
      },
      {
        name: messages.config.afficher.champCouleur,
        value:
          settings.embedColor === null
            ? messages.config.afficher.valeurDefaut
            : `#${settings.embedColor.toString(16).padStart(6, "0")}`,
      },
    );
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
