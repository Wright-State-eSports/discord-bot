import { Events, type Interaction } from 'discord.js';

import { CommandRegistry, AppLogger } from '../utils';

/**
 * Handles autocomplete interactions by delegating to the matching command's autocomplete handler.
 */
export default {
  name: 'autocomplete',
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction): Promise<void> => {
    const logger = AppLogger.get('events').child('autocomplete');
    if (!interaction.isAutocomplete()) return;

    try {
      const command = CommandRegistry.get(interaction.commandName) as ChatInputCommand | undefined;
      if (!command) {
        logger.warn(`No command found for '${interaction.commandName}'`);
        await interaction.respond([]);
        return;
      }

      if (!command.autocomplete) {
        logger.warn(`No autocomplete handler found for '${interaction.commandName}'`);
        await interaction.respond([]);
        return;
      }

      logger.debug(`Executing autocomplete for '${interaction.commandName}'`);
      await command.autocomplete(interaction);
    } catch (error) {
      logger.error(error, 'Error occurred while executing autocomplete:');
    }
  },
} satisfies EventHandler<Events.InteractionCreate>;
