import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { AppLogger, DiscordLogger, userCombo } from '../utils';

/**
 * Admin-only command to cleanly shut down the bot process.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Safely shuts down the bot (Administrator only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const logger = AppLogger.get('discord').child(['command', 'stop']);

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      logger.warn(`${userCombo(interaction)} attempted to use /stop without Administrator permissions.`);
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    logger.info(`${userCombo(interaction)} initiated bot shutdown via /stop.`);

    await interaction.reply({
      content: '🛑 Shutting down the bot...',
      flags: MessageFlags.Ephemeral,
    });

    await DiscordLogger.embed(
      logger.warn,
      `🛑 Bot shutdown initiated by ${userCombo(interaction)} in ${interaction.channel ? `<#${interaction.channel.id}>` : 'DM'}.`,
      {
        options: {
          title: 'Bot Shutting Down',
          color: 0xef4444,
        },
      },
    );

    // Destroy client gateway connection and exit process cleanly
    setTimeout(async () => {
      await interaction.client.destroy();
      process.exit(0);
    }, 500);
  },
} satisfies ChatInputCommand;
