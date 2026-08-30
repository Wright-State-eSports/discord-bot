import { MessageFlags, PermissionFlagsBits, type AnySelectMenuInteraction } from 'discord.js';

import {
  AppLogger,
  DiscordLogger,
  buildMatchedActionRows,
  buildMatchedRegistrationEmbed,
  extractRegistrationDataFromCard,
  isRegistrationAlreadyApproved,
  userCombo,
} from '../../utils';

/**
 * Handles selecting or picking a user from the registration card's select menu.
 * Links the chosen Discord user to the registration card and updates the buttons to Approve/Remind.
 */
export async function handleSelectRegistrationUser(interaction: AnySelectMenuInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['select-menu', 'registration-user']);
  logger.info(`${userCombo(interaction)} selected user in registration menu`);

  if (!interaction.guild) return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    logger.warn(`${userCombo(interaction)} attempted to select a registration user without Administrator permissions.`);
    await interaction.reply({
      content: '❌ You do not have permission to select a user for registration.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedUserId = interaction.values[0];
  if (!selectedUserId) {
    logger.warn('No user ID selected in interaction.');
    return;
  }

  const member = await interaction.guild.members.fetch(selectedUserId).catch(() => null);
  if (!member) {
    logger.warn(`Could not fetch member with ID ${selectedUserId}`);
    await interaction.reply({
      content: '❌ Could not find the selected member in this server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const registrationData = extractRegistrationDataFromCard(interaction.message);
  if (!registrationData) {
    logger.error('Failed to extract registration data from card message.');
    await interaction.reply({
      content: '❌ Could not parse registration data from this card.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const isMember = registrationData.registerAs === 'member';
  const userAlreadyApproved = await isRegistrationAlreadyApproved(member, registrationData.registerAs);

  const matchedEmbed = await buildMatchedRegistrationEmbed(registrationData, member);
  const actionRows = buildMatchedActionRows(isMember, userAlreadyApproved, true);

  await interaction.update({
    embeds: [matchedEmbed],
    components: actionRows,
  });

  logger.info(
    `Admin ${userCombo(interaction)} linked member ${userCombo(member)} (${member.id}) to registration for ${registrationData.name}`,
  );
  await DiscordLogger.log(
    logger.info,
    `${userCombo(interaction)} linked Discord user ${userCombo(member)} for registration of **${registrationData.name}**`,
  );
}

export default handleSelectRegistrationUser;
