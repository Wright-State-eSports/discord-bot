import { SlashCommandBuilder, Interaction } from 'discord.js';

/**
 * @typedef { object } Command
 * @property { SlashCommandBuilder } data
 * @property { (interaction: Interaction, ...params) => Promise<void | any>} execute
 */
