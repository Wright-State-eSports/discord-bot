import { Events, type Interaction } from 'discord.js';

import { CommandRegistry, AppLogger } from '../utils';

export default {
  name: 'autocomplete',
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction): Promise<void> => {
    const logger = AppLogger.get('events').child('autocomplete');
    if (!interaction.isAutocomplete()) return;

    try {
      const command = CommandRegistry.get(interaction.commandName);
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
