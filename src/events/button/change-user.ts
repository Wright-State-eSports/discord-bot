import { MessageFlags, PermissionFlagsBits, type ButtonInteraction } from 'discord.js';

import {
  AppLogger,
  buildUnmatchedActionRows,
  buildUnmatchedRegistrationEmbed,
  extractRegistrationDataFromCard,
  findSimilarGuildMembers,
  userCombo,
} from '../../utils';

/**
 * Handles the 'Change User' button on a matched registration card.
 * Returns the card back to the candidate selection menu and user picker.
 */
export async function handleChangeRegistrationUser(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'change-user']);
  logger.info(`${userCombo(interaction)} pressed Change User on registration card`);

  if (!interaction.guild) return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    logger.warn(`${userCombo(interaction)} attempted to use Change User without Administrator permissions.`);
    await interaction.reply({
      content: '❌ You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const data = extractRegistrationDataFromCard(interaction.message);
  if (!data) {
    logger.error('Failed to extract registration data from card message.');
    await interaction.reply({
      content: '❌ Could not parse registration data from this card.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  const similarMatches = await findSimilarGuildMembers(interaction.guild, data.discordUsername, 5, {
    name: data.name,
    email: data.email,
  });

  const unmatchedEmbed = buildUnmatchedRegistrationEmbed(data, similarMatches);
  const actionRows = buildUnmatchedActionRows(similarMatches);

  await interaction.editReply({
    embeds: [unmatchedEmbed],
    components: actionRows,
  });

  logger.info(`Re-opened candidate selection for ${data.name} (${data.discordUsername})`);
}

export default handleChangeRegistrationUser;
