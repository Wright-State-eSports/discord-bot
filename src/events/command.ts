import { MessageFlags, type Interaction } from 'discord.js';

import { eventsLogger } from '.';
import { userCombo } from '../utils';
import { registry, unloaded } from '../utils/commands';

/**
 * Handles command interactions.
 *
 * This function is called whenever a command interaction is created.
 * It checks if the command exists in the registry and executes it if it does.
 *
 * @param interaction Discord Interaction
 */
export default async function commandHandler(interaction: Interaction): Promise<void> {
  const logger = eventsLogger.child('command');
  if (!interaction.isChatInputCommand()) return;

  try {
    const command = registry.get(interaction.commandName);
    if (!command) {
      if (unloaded.has(interaction.commandName)) {
        logger.warn(`Command ${interaction.commandName} is unloaded`);
        await interaction.reply({ content: 'Command is unloaded', flags: MessageFlags.Ephemeral });
        return;
      }

      logger.warn(
        `${userCombo(interaction)} attempted to execute a command that does not exist: ${interaction.commandName}`,
      );
      await interaction.reply({ content: 'Command not found', flags: MessageFlags.Ephemeral });
      return;
    }

    logger.debug(`${userCombo(interaction)} executing command '${interaction.commandName}'`);
    await command.execute(interaction);
  } catch (error) {
    logger.error(error, `Error occurred while executing command '${interaction.commandName}':`);
  }
}
