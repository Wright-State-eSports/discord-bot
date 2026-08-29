import type { ButtonInteraction } from 'discord.js';

import { AppLogger, DiscordLogger, MessageSelection, userCombo } from '../../utils';

/** Cancels the user's active message selection, handling cases where the selection expired or the bot was restarted. */
export async function handleCancelMessageSelection(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'cancel-message-selection']);
  const hadSelection = MessageSelection.has(interaction.user.id);
  MessageSelection.clear(interaction.user.id);

  logger.info(`${userCombo(interaction)} cancelled message selection (had active selection: ${hadSelection})`);

  await DiscordLogger.log(
    logger.info,
    `${userCombo(interaction)} cancelled message selection (had active selection: ${hadSelection})`,
  );

  await interaction.update({
    content: hadSelection
      ? '🚫 Message selection cleared.'
      : 'ℹ️ No active message selection was found (it may have expired or been cleared already). Selection reset.',
    components: [],
  });
}

export default handleCancelMessageSelection;
