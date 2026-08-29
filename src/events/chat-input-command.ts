import { Events, MessageFlags, type Interaction } from 'discord.js';

import { AppLogger, DiscordLogger, userCombo, CommandRegistry } from '../utils';

/**
 * Handles chat input (slash) command interactions.
 *
 * This function is called whenever a chat input command interaction is created.
 * It checks if the command exists in the registry and executes it if it does.
 *
 * @param interaction Discord Interaction
 */
export default {
  name: 'chat-input-command',
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction): Promise<void> => {
    const logger = AppLogger.get('discord').child(['event', 'chat-input-command']);
    if (!interaction.isChatInputCommand()) return;

    try {
      const command = CommandRegistry.get(interaction.commandName);
      if (!command) {
        if (CommandRegistry.unloaded.has(interaction.commandName)) {
          await DiscordLogger.embed(
            logger.warn,
            `${userCombo(interaction)} attempted to execute an unloaded command: ${interaction.commandName}`,
          );

          logger.warn(`Command ${interaction.commandName} is unloaded`);
          await interaction.reply({ content: 'Command is unloaded', flags: MessageFlags.Ephemeral });
          return;
        }

        await DiscordLogger.embed(
          logger.warn,
          `${userCombo(interaction)} attempted to execute a command that does not exist: ${interaction.commandName}`,
        );
        await interaction.reply({ content: 'Command not found', flags: MessageFlags.Ephemeral });
        return;
      }

      logger.debug(`${userCombo(interaction)} executing command '${interaction.commandName}'`);
      await DiscordLogger.log(
        logger.info,
        `${userCombo(interaction)} used /${interaction.commandName} in ${interaction.channel ? `<#${interaction.channel.id}>` : 'DM'}`,
      );
      await (command as ChatInputCommand).execute(interaction);
    } catch (error) {
      await DiscordLogger.embed(
        logger.error,
        `${userCombo(interaction)} attempted to execute command '${interaction.commandName}' with an error`,
        { error },
      );
    }
  },
} satisfies EventHandler<Events.InteractionCreate>;
