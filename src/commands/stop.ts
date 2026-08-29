import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { execFile } from 'node:child_process';

import { AppLogger, confirmPrompt, DiscordLogger, userCombo } from '../utils';

const SAFE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const DEFAULT_PROCESS_NAME = 'esports-bot-dev';

/**
 * Admin-only command to cleanly shut down the bot and delete its PM2 process
 * to prevent PM2 from automatically restarting the instance.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Safely shuts down the bot and stops PM2 process (Administrator only).')
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

    const { confirmed, interaction: buttonInteraction } = await confirmPrompt(interaction, {
      content: '⚠️ **Are you sure you want to stop and shut down the bot instance?**',
      confirmLabel: 'Yes, Stop Bot',
      cancelLabel: 'Cancel',
      ephemeral: true,
    });

    if (!confirmed) {
      return;
    }

    logger.info(`${userCombo(interaction)} confirmed bot shutdown via /stop.`);

    if (buttonInteraction) {
      await buttonInteraction.update({
        content: '🛑 Shutting down bot instance...',
        components: [],
      });
    } else {
      await interaction.editReply({
        content: '🛑 Shutting down bot instance...',
        components: [],
      });
    }

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

    // Sanitize and validate process name to prevent command injection
    const rawProcessName = process.env.name || process.env.PM2_PROCESS_NAME || DEFAULT_PROCESS_NAME;
    const pm2ProcessName = SAFE_NAME_REGEX.test(rawProcessName) ? rawProcessName : DEFAULT_PROCESS_NAME;

    setTimeout(async () => {
      try {
        await interaction.client.destroy();
        logger.info('Discord client connection destroyed.');
      } catch (err) {
        logger.error(err, 'Error destroying Discord client connection:');
      }

      logger.info(`Stopping and deleting PM2 process: "${pm2ProcessName}"`);

      // Using execFile without a shell passes arguments as discrete tokens to execve,
      // eliminating shell interpolation and command injection risks.
      execFile('pm2', ['delete', pm2ProcessName], (error, stdout, stderr) => {
        if (error) {
          logger.warn(
            { error: error.message, stderr },
            `Could not delete PM2 process "${pm2ProcessName}" (not running under PM2 or permission issue). Exiting process.`,
          );
          process.exit(0);
        }

        logger.info({ stdout }, `PM2 process "${pm2ProcessName}" successfully deleted.`);
        process.exit(0);
      });

      // Safety timeout to ensure process terminates even if PM2 command hangs
      setTimeout(() => {
        process.exit(0);
      }, 3000);
    }, 500);
  },
} satisfies ChatInputCommand;
