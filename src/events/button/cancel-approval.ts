import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type TextBasedChannel,
} from 'discord.js';

import {
  AppLogger,
  DiscordLogger,
  extractNotificationIds,
  extractUserIdFromCard,
  revertGuest,
  revertRaider,
  userCombo,
} from '../../utils';

/** Reverts an approval — removes the assigned role, deletes the approval notification, and resets the button back to Approve. */
export async function handleCancelApproval(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'cancel-approval']);
  logger.info(`${userCombo(interaction)} pressed Cancel Approval`);

  if (!interaction.guild) return;

  const userId = extractUserIdFromCard(interaction);
  if (!userId) {
    logger.warn('Could not extract user ID from registration embed.');
    return;
  }

  await interaction.deferUpdate();

  const embed = interaction.message.embeds[0];
  // The embed is the only source of truth at button-click time — we
  // derive the original registration type from the title or a field
  // rather than making another API call.
  const isGuest =
    embed?.title === 'New Guest' ||
    embed?.fields.some((f) => f.name === 'Register As' && f.value.toLowerCase() === 'guest');

  try {
    const member = await interaction.guild.members.fetch(userId);

    // Delete the previous approval notification message if tracked in message content or embed footer
    const notif = extractNotificationIds(interaction);
    if (notif) {
      try {
        const notifChannel = (await interaction.client.channels
          .fetch(notif.channelId)
          .catch(() => null)) as TextBasedChannel | null;
        if (notifChannel && 'messages' in notifChannel) {
          const notifMsg = await notifChannel.messages.fetch(notif.messageId).catch(() => null);
          if (notifMsg) {
            await notifMsg.delete().catch(() => {});
            logger.info(`Deleted approval notification message ${notif.messageId} in channel ${notif.channelId}`);
          }
        }
      } catch (delError) {
        logger.warn(delError, `Failed to delete approval notification message ${notif.messageId}`);
      }
    }

    if (isGuest) {
      await revertGuest(member);
      logger.info(`Reverted Guest roles for ${member.user.tag}`);
    } else {
      await revertRaider(member);
      logger.info(`Reverted Raider roles for ${member.user.tag}`);

      if (process.env.SCRIPT_LINK) {
        const nameField = embed?.fields.find((f) => f.name === 'Name')?.value || '';
        const rowField = embed?.fields.find((f) => f.name === 'Sheet Row')?.value || '';

        await fetch(process.env.SCRIPT_LINK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'disapprove', username: nameField, rowNum: rowField }),
        }).catch((err) => logger.warn(err, 'Failed to update Google Sheet for cancellation'));
      }
    }

    await DiscordLogger.log(
      logger.info,
      `${userCombo(interaction)} cancelled approval for <@${userId}> (${member.user.tag})`,
    );

    // Reset button back to Approve
    const approve = new ButtonBuilder()
      .setCustomId(isGuest ? 'approve-guest' : 'approve-member')
      .setLabel(isGuest ? 'Approve Guest' : 'Approve Member')
      .setStyle(isGuest ? ButtonStyle.Secondary : ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approve);

    if (!isGuest) {
      const engage = new ButtonBuilder()
        .setLabel('Engage')
        .setStyle(ButtonStyle.Link)
        .setURL('https://wright.campuslabs.com/engage/actioncenter/organization/esports/roster/Roster/prospective');
      row.addComponents(engage);
    }

    // Reset content back to base divider and ensure footer is cleared
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFooter(null);

    await interaction.editReply({
      content: '▬▬▬▬▬▬▬▬▬▬',
      embeds: [updatedEmbed],
      components: [row],
    });
    logger.info(`Reset buttons to Approve for ${userId}`);
  } catch (err) {
    logger.error(err, `Error cancelling approval for ${userId}`);
  }
}

export default handleCancelApproval;
