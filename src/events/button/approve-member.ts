import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
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
  formatCardContent,
  promoteToRaider,
  syncRegistrationSheet,
  userCombo,
} from '../../utils';

/** Grants the Raider role, removes Not-Signed-Up / Guest, and notifies the help channel and Google Sheet. */
export async function handleApproveMember(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'approve-member']);
  logger.info(`${userCombo(interaction)} pressed Approve Member`);

  if (!interaction.guild) return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    logger.warn(`${userCombo(interaction)} attempted to use Approve Member without Administrator permissions.`);
    await interaction.reply({
      content: '❌ You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

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
    await DiscordLogger.log(logger.info, `${userCombo(interaction)} approved member ${userCombo(member)}`);

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

      await syncRegistrationSheet({ mode: 'approve', name: nameField, rowNum: rowField });
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

    const remind = new ButtonBuilder()
      .setCustomId('remind-signup')
      .setLabel('Remind')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔔');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disapprove, engage, remind);

    // Update message content with subtext tracking the approval notification (preserving existing reminder metadata)
    const updatedContent = formatCardContent(interaction.message, {
      notification: sentMsg ? { channelId: helpChannelId, messageId: sentMsg.id } : null,
    });
    await interaction.editReply({ content: updatedContent, components: [row] });
    logger.info(`Updated message buttons to Cancel Approval for ${userId}`);
  } catch (err) {
    logger.error(err, `Error approving member ${userId}`);
  }
}

export default handleApproveMember;
