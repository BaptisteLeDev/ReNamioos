/**
 * Commande /ping — tracer bullet de bout en bout (Discord -> reponse).
 *
 * Repond "Pong" avec la latence WebSocket. C'est le successeur de `/ping` du
 * bot.py legacy (cf. docs/caracterisation.md, ligne `bot.py:246`).
 */
import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "./types";

export const pingCommand: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Repond Pong avec la latence."),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const latency = Math.max(0, Math.round(interaction.client.ws.ping));
    await interaction.reply(`Pong ! Latence: ${latency}ms`);
  },
};
