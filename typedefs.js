/**
 * @typedef { import('discord.js').Interaction } Interaction
 * @typedef { import('discord.js').SlashCommandBuilder } SlashCommandBuilder
 * @typedef { import('discord.js').Client } Client
 */

/**
 * @typedef { object } Command
 * @property { SlashCommandBuilder } data
 * @property { (interaction: Interaction, ...params) => Promise<void | any>} execute
 */
