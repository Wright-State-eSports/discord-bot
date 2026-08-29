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
  promoteToRaider,
  userCombo,
} from '../../utils';

/** Grants the Raider role, removes Not-Signed-Up / Guest, and notifies the help channel and Google Sheet. */
export async function handleApproveMember(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'approve-member']);
  logger.info(`${userCombo(interaction)} pressed Approve Member`);

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
    logger.error('Help channel ID is not configured (channels.help). Member approval aborted.');
    await interaction.reply({
      content: '❌ Help channel is not configured in the bot settings.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    const member = await interaction.guild.members.fetch(userId);
    await promoteToRaider(member);
    logger.info(`Assigned Raider role to ${member.user.tag} (${member.id})`);
    await DiscordLogger.log(logger.info, `${userCombo(interaction)} approved member <@${userId}> (${member.user.tag})`);

    // Notify help channel and record the message
    let sentMsg: Message | null = null;
    const helpChannel = (await interaction.client.channels
      .fetch(helpChannelId)
      .catch(() => null)) as TextBasedChannel | null;
    if (helpChannel && helpChannel.isSendable()) {
      sentMsg = await helpChannel.send(`<@${userId}>, you are set!`);
    }

    // Notify Google script if configured
    if (process.env.SCRIPT_LINK) {
      const embed = interaction.message.embeds[0];
      const nameField = embed?.fields.find((f) => f.name === 'Name')?.value || '';
      const rowField = embed?.fields.find((f) => f.name === 'Sheet Row')?.value || '';

      await fetch(process.env.SCRIPT_LINK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'approve', name: nameField, rowNum: rowField }),
      }).catch((err) => logger.warn(err, 'Failed to update Google Sheet for member approval'));
    }

    // Switch button to Cancel Approval
    const disapprove = new ButtonBuilder()
      .setCustomId('cancel-approval')
      .setLabel('Cancel Approval')
      .setStyle(ButtonStyle.Danger);

    const engage = new ButtonBuilder()
      .setLabel('Engage')
      .setStyle(ButtonStyle.Link)
      .setURL('https://wright.campuslabs.com/engage/actioncenter/organization/esports/roster/Roster/prospective');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disapprove, engage);

    // Update message content with subtext tracking the approval notification
    const notifText = sentMsg ? formatNotificationSubtext(helpChannelId, sentMsg.id) : '';
    await interaction.editReply({ content: `▬▬▬▬▬▬▬▬▬▬${notifText}`, components: [row] });
    logger.info(`Updated message buttons to Cancel Approval for ${userId}`);
  } catch (err) {
    logger.error(err, `Error approving member ${userId}`);
  }
}

export default handleApproveMember;
