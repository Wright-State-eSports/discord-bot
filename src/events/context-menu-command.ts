import { Events, MessageFlags, type Interaction } from 'discord.js';

import { AppLogger, DiscordLogger, InteractionTracker, channelCombo, userCombo, CommandRegistry } from '../utils';

/**
 * Handles context menu (Message & User) command interactions.
 *
 * This function is called whenever a context menu interaction is created.
 * It tracks in-flight execution, measures performance duration, and logs on completion or error.
 *
 * @param interaction Discord Interaction
 */
export default {
  name: 'context-menu-command',
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction): Promise<void> => {
    const logger = AppLogger.get('discord').child(['event', 'context-menu-command']);
    if (!interaction.isContextMenuCommand()) return;

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

    const tracker = InteractionTracker.start(interaction.id, {
      type: 'context-menu',
      name: interaction.commandName,
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      channelId: interaction.channelId ?? undefined,
    });

    logger.debug(`${userCombo(interaction)} started executing context command '${interaction.commandName}'`);

    try {
      if (interaction.isMessageContextMenuCommand()) {
        await (command as MessageContextMenuCommand).execute(interaction);
      } else if (interaction.isUserContextMenuCommand()) {
        await (command as UserContextMenuCommand).execute(interaction);
      }
      const duration = tracker.end();

      logger.debug(`${userCombo(interaction)} completed context command '${interaction.commandName}' in ${duration}ms`);
      await DiscordLogger.log(
        logger.info,
        `${userCombo(interaction)} used context menu "${interaction.commandName}" in ${channelCombo(interaction.channel)} [took ${duration}ms]`,
      );
    } catch (error) {
      const duration = tracker.end();
      logger.error(error, `Error executing context command '${interaction.commandName}' after ${duration}ms:`);
      await DiscordLogger.embed(
        logger.error,
        `${userCombo(interaction)} failed to execute context menu "${interaction.commandName}" in ${channelCombo(interaction.channel)} [after ${duration}ms]`,
        { error },
      );
    }
  },
} satisfies EventHandler<Events.InteractionCreate>;
