import type { Interaction } from 'discord.js';

import { eventsLogger } from '.';
import { registry } from '../utils/commands';

/**
 * Handles autocomplete interactions.
 *
 * @param interaction The autocomplete interaction
 */
export default async function autocompleteHandler(interaction: Interaction): Promise<void> {
  const logger = eventsLogger.child('autocomplete');
  if (!interaction.isAutocomplete()) return;

  try {
    const command = registry.get(interaction.commandName);
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
}
