import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
  type Message,
  type TextBasedChannel,
} from 'discord.js';

import {
  AppLogger,
  Config,
  ConfigKeys,
  DiscordLogger,
  extractUserIdFromCard,
  formatNotificationSubtext,
  promoteToGuest,
  userCombo,
} from '../../utils';

/** Grants the Guest role, removes Not-Signed-Up, and notifies the help channel. */
export async function handleApproveGuest(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'approve-guest']);
  logger.info(`${userCombo(interaction)} pressed Approve Guest`);

  if (!interaction.guild) return;

  const userId = extractUserIdFromCard(interaction);
  if (!userId) {
    logger.warn('Could not extract user ID from registration embed.');
    await interaction.reply({
      content: '❌ Could not find target user ID from the registration card.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const helpChannelId = await Config.get(ConfigKeys.Channels.Help);
  if (!helpChannelId) {
    logger.error('Help channel ID is not configured (channels.help). Guest approval aborted.');
    await interaction.reply({
      content: '❌ Help channel is not configured in the bot settings.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    const member = await interaction.guild.members.fetch(userId);
    await promoteToGuest(member);
    logger.info(`Assigned Guest role to ${member.user.tag} (${member.id})`);
    await DiscordLogger.log(logger.info, `${userCombo(interaction)} approved guest <@${userId}> (${member.user.tag})`);

    // Notify help channel and record the message
    let sentMsg: Message | null = null;
    const helpChannel = (await interaction.client.channels
      .fetch(helpChannelId)
      .catch(() => null)) as TextBasedChannel | null;
    if (helpChannel && helpChannel.isSendable()) {
      sentMsg = await helpChannel.send(`<@${userId}>, you are set!`);
    }

    // Switch button to Cancel Approval
    const disapprove = new ButtonBuilder()
      .setCustomId('cancel-approval')
      .setLabel('Cancel Approval')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disapprove);

    // Update message content with subtext tracking the approval notification
    const notifText = sentMsg ? formatNotificationSubtext(helpChannelId, sentMsg.id) : '';
    await interaction.editReply({ content: `▬▬▬▬▬▬▬▬▬▬${notifText}`, components: [row] });
    logger.info(`Updated message buttons to Cancel Approval for guest ${userId}`);
  } catch (err) {
    logger.error(err, `Error approving guest ${userId}`);
  }
}

export default handleApproveGuest;
