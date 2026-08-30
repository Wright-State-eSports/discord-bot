import { Events, type Interaction } from 'discord.js';

import { AppLogger, userCombo } from '../../utils';
import { handleAnnounceStudioSelectChannel } from './announce-studio';
import { handleSelectRegistrationUser } from './registration-user';

export * from './announce-studio';
export * from './registration-user';

/**
 * Handles select menu interactions across the application.
 * Routes each select menu's customId to its dedicated handler function.
 */
export default {
  name: 'select-menu',
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction): Promise<void> => {
    if (!interaction.isAnySelectMenu()) return;

    const logger = AppLogger.get('events').child('select-menu');

    try {
      const customId = interaction.customId;
      logger.debug(`${userCombo(interaction)} interacted with select menu: ${customId}`);

      if (customId.startsWith('announce-studio-select-channel')) {
        if (interaction.isChannelSelectMenu()) {
          await handleAnnounceStudioSelectChannel(interaction);
        }
        return;
      }

      switch (customId) {
        case 'select-registration-user':
        case 'pick-registration-user':
          await handleSelectRegistrationUser(interaction);
          break;

        default:
          break;
      }
    } catch (error) {
      logger.error(error, `Error executing select menu interaction ${interaction.customId}:`);
    }
  },
} satisfies EventHandler<Events.InteractionCreate>;
