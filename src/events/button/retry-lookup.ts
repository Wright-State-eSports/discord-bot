import { MessageFlags, PermissionFlagsBits, type ButtonInteraction } from 'discord.js';

import {
  AppLogger,
  DiscordLogger,
  buildMatchedActionRows,
  buildMatchedRegistrationEmbed,
  buildUnmatchedActionRows,
  buildUnmatchedRegistrationEmbed,
  extractRegistrationDataFromCard,
  findGuildMember,
  findSimilarGuildMembers,
  isRegistrationAlreadyApproved,
  userCombo,
} from '../../utils';

/**
 * Handles the 'Retry Search' button on an unmatched registration card.
 * Re-scans the guild for exact or similar member matches (e.g., after a user joins the server).
 */
export async function handleRetryRegistrationLookup(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'retry-lookup']);
  logger.info(`${userCombo(interaction)} pressed Retry Search on registration card`);

  if (!interaction.guild) return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    logger.warn(`${userCombo(interaction)} attempted to use Retry Search without Administrator permissions.`);
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

  // 1. Check if user now has an exact match
  const member = await findGuildMember(interaction.guild, data.discordUsername, {
    name: data.name,
    email: data.email,
  });

  if (member) {
    const isMember = data.registerAs === 'member';
    const userAlreadyApproved = await isRegistrationAlreadyApproved(member, data.registerAs);
    const matchedEmbed = buildMatchedRegistrationEmbed(data, member);
    const actionRows = buildMatchedActionRows(isMember, userAlreadyApproved, true);

    await interaction.editReply({
      embeds: [matchedEmbed],
      components: actionRows,
    });

    logger.info(`Exact match found on retry for ${data.name}: ${member.user.tag} (${member.id})`);
    await DiscordLogger.log(
      logger.info,
      `${userCombo(interaction)} retried search: automatically linked ${userCombo(member)} for **${data.name}**`,
    );
    return;
  }

  // 2. Otherwise refresh top similar candidates
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

  logger.info(`Refreshed candidate suggestions on retry for ${data.name} (${similarMatches.length} candidates found)`);
}

export default handleRetryRegistrationLookup;
