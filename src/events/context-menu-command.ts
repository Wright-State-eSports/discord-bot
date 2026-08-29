import { Events, MessageFlags, type Interaction } from 'discord.js';

import { AppLogger, DiscordLogger, userCombo, CommandRegistry } from '../utils';

/**
 * Handles context menu (Message & User) command interactions.
 *
 * This function is called whenever a context menu interaction is created.
 * It checks if the command exists in the registry and executes it if it does.
 *
 * @param interaction Discord Interaction
 */
export default {
  name: 'context-menu-command',
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction): Promise<void> => {
    const logger = AppLogger.get('discord').child(['event', 'context-menu-command']);
    if (!interaction.isContextMenuCommand()) return;

    try {
      const command = CommandRegistry.get(interaction.commandName);
      if (!command) {
        if (CommandRegistry.unloaded.has(interaction.commandName)) {
          await DiscordLogger.embed(
            logger.warn,
            `${userCombo(interaction)} attempted to execute an unloaded context command: ${interaction.commandName}`,
          );

          logger.warn(`Context command ${interaction.commandName} is unloaded`);
          await interaction.reply({ content: 'Command is unloaded', flags: MessageFlags.Ephemeral });
          return;
        }

        await DiscordLogger.embed(
          logger.warn,
          `${userCombo(interaction)} attempted to execute a context command that does not exist: ${interaction.commandName}`,
        );
        await interaction.reply({ content: 'Command not found', flags: MessageFlags.Ephemeral });
        return;
      }

      logger.debug(`${userCombo(interaction)} executing context command '${interaction.commandName}'`);
      await DiscordLogger.log(
        logger.info,
        `${userCombo(interaction)} used context menu "${interaction.commandName}" in ${interaction.channel ? `<#${interaction.channel.id}>` : 'DM'}`,
      );
      if (interaction.isMessageContextMenuCommand()) {
        await (command as MessageContextMenuCommand).execute(interaction);
      } else if (interaction.isUserContextMenuCommand()) {
        await (command as UserContextMenuCommand).execute(interaction);
      }
    } catch (error) {
      await DiscordLogger.embed(
        logger.error,
        `${userCombo(interaction)} attempted to execute context command '${interaction.commandName}' with an error`,
        { error },
      );
    }
  },
} satisfies EventHandler<Events.InteractionCreate>;
