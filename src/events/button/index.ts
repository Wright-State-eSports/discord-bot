import { Events, type Interaction } from 'discord.js';

import { AppLogger, userCombo } from '../../utils';
import { handleAnnounceStudioButton } from './announce-studio';
import { handleApproveGuest } from './approve-guest';
import { handleApproveMember } from './approve-member';
import { handleCancelApproval } from './cancel-approval';
import { handleCancelMessageSelection } from './cancel-message-selection';
import { handleChangeRegistrationUser } from './change-user';
import { handleRemind } from './remind';
import { handleRetryRegistrationLookup } from './retry-lookup';
import { handleSignUpForm } from './signup-form';

export * from './announce-studio';
export * from './approve-guest';
export * from './approve-member';
export * from './cancel-approval';
export * from './cancel-message-selection';
export * from './change-user';
export * from './remind';
export * from './retry-lookup';
export * from './signup-form';

/**
 * Handles button interactions across the application.
 * Routes each button's customId to its dedicated handler function.
 */
export default {
  name: 'button',
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction): Promise<void> => {
    if (!interaction.isButton()) return;

    const logger = AppLogger.get('events').child('button');

    try {
      const customId = interaction.customId;
      logger.debug(`${userCombo(interaction)} clicked button with customId: ${customId}`);

      switch (customId) {
        case 'approve-member':
        case 'approveMember':
          await handleApproveMember(interaction);
          break;

        case 'approve-guest':
        case 'approveGuest':
          await handleApproveGuest(interaction);
          break;

        case 'cancel-approval':
        case 'cancelApproval':
          await handleCancelApproval(interaction);
          break;

        case 'remind-signup':
        case 'remind':
        case 'remind-member':
        case 'remindMember':
          await handleRemind(interaction);
          break;

        case 'signup-form':
        case 'sign-up-form':
          await handleSignUpForm(interaction);
          break;

        case 'cancel-message-selection':
        case 'cancelMessageSelection':
          await handleCancelMessageSelection(interaction);
          break;

        case 'change-registration-user':
        case 'changeRegistrationUser':
          await handleChangeRegistrationUser(interaction);
          break;

        case 'retry-registration-lookup':
        case 'retryRegistrationLookup':
          await handleRetryRegistrationLookup(interaction);
          break;

        default:
          if (customId.startsWith('announce-studio-')) {
            await handleAnnounceStudioButton(interaction);
          }
          break;
      }
    } catch (error) {
      logger.error(error, `Error executing button interaction ${interaction.customId}:`);
    }
  },
} satisfies EventHandler<Events.InteractionCreate>;
