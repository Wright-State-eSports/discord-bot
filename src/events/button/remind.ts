import {
  ButtonStyle,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type TextChannel,
  type ThreadChannel,
} from 'discord.js';

import {
  AppLogger,
  Config,
  ConfigKeys,
  DiscordLogger,
  channelCombo,
  confirmPrompt,
  extractReminderThreadId,
  extractUserIdFromCard,
  formatCardContent,
  userCombo,
} from '../../utils';

/**
 * Handles the 'remind-signup' button on registration cards.
 * Prevents duplicate reminder threads, adds subsequent clicking officers to existing threads,
 * or prompts for interactive confirmation before creating a new private thread in the help channel.
 */
export async function handleRemind(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'remind']);
  logger.info(`${userCombo(interaction)} pressed Remind button`);

  if (!interaction.guild) return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    logger.warn(`${userCombo(interaction)} attempted to use Remind button without Administrator permissions.`);
    await interaction.reply({
      content: '❌ You do not have permission to use this button.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = extractUserIdFromCard(interaction);
  if (!userId) {
    logger.warn('Could not extract user ID from registration card.');
    await interaction.reply({
      content: '❌ Could not find target user ID from the registration card.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if a reminder thread was already created for this card
  const existingReminder = extractReminderThreadId(interaction.message);
  if (existingReminder) {
    const existingThread = (await interaction.client.channels
      .fetch(existingReminder.threadId)
      .catch(() => null)) as ThreadChannel | null;

    if (existingThread) {
      // Check if clicking officer is already a member of the thread
      const isAlreadyInThread = await existingThread.members.fetch(interaction.user.id).catch(() => null);

      if (isAlreadyInThread) {
        logger.info(`${userCombo(interaction)} clicked Remind but is already in reminder thread ${existingThread.id}.`);
        await interaction.reply({
          content: `ℹ️ You are already in the active reminder thread: <#${existingThread.id}> ([Jump to Thread](${existingThread.url})).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      logger.info(`Existing reminder thread ${existingThread.id} found. Adding ${userCombo(interaction)} to it.`);
      await existingThread.members.add(interaction.user.id).catch(() => null);

      await DiscordLogger.log(
        logger.info,
        `${userCombo(interaction)} was added to existing reminder thread ${channelCombo(existingThread)}`,
      );

      await interaction.reply({
        content: `ℹ️ A reminder thread is already open for this user. You have been added to <#${existingThread.id}> ([Jump to Thread](${existingThread.url}))!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const helpChannelId = await Config.get(ConfigKeys.Channels.Help);
  if (!helpChannelId) {
    logger.error('Help channel ID is not configured (channels.help). Cannot create reminder thread.');
    await interaction.reply({
      content: '❌ Help channel is not configured in the bot settings.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const helpChannel = (await interaction.client.channels.fetch(helpChannelId).catch(() => null)) as TextChannel | null;

  if (!helpChannel || !('threads' in helpChannel)) {
    logger.error(`Help channel ${helpChannelId} not found or does not support threads.`);
    await interaction.reply({
      content: `❌ Help channel (<#${helpChannelId}>) could not be found or does not support threads.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  const targetName = member?.displayName ?? member?.user.username ?? userId;

  const { confirmed, interaction: buttonInteraction } = await confirmPrompt(interaction, {
    content: `🔔 **Create a private sign-up reminder thread for ${userCombo(member, userId)} in <#${helpChannelId}>?**\n\nThis will ping the user and direct them to complete their Engage roster and Sign-Up Form.`,
    confirmLabel: 'Send Reminder',
    confirmStyle: ButtonStyle.Primary,
    cancelLabel: 'Cancel',
    ephemeral: true,
  });

  if (!confirmed) {
    logger.info(`${userCombo(interaction)} cancelled sending sign-up reminder for ${userId}.`);
    return;
  }

  if (buttonInteraction) {
    await buttonInteraction.update({
      content: `⏳ Creating private reminder thread for ${userCombo(member, userId)}...`,
      components: [],
    });
  }

  try {
    const thread = await helpChannel.threads.create({
      name: `Sign-Up Reminder - ${targetName}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Private sign-up reminder triggered by ${interaction.user.tag} for ${targetName}`,
    });

    // Add target member and invoking officer explicitly to ensure immediate access
    await thread.members.add(userId).catch(() => null);
    await thread.members.add(interaction.user.id).catch(() => null);

    const reminderMessage = `Hey <@${userId}>! 👋

An Officer (<@${interaction.user.id}>) has triggered a reminder regarding your registration with Wright State Esports.

It looks like your sign-up might still be incomplete. Please make sure you have completed the following:
• **Engage Roster:** Join our organization on Engage at https://engage.wsu.edu/organization/wsu-esports
• **Sign-Up Form:** Complete the official sign-up form in the sign-up channel.

If you have already done both, have any questions, or believe this was sent in error, please reply here and tag <@${interaction.user.id}> or an Officer!`;

    await thread.send({ content: reminderMessage });

    // Track the reminder thread in the card message subtext so subsequent clicks join this thread
    const updatedCardContent = formatCardContent(interaction.message, {
      reminder: { helpChannelId, threadId: thread.id },
    });
    await interaction.message.edit({ content: updatedCardContent });

    await DiscordLogger.log(
      logger.info,
      `${userCombo(interaction)} created a sign-up reminder thread for ${userCombo(member, userId)} in ${channelCombo(thread)}`,
    );

    await interaction.editReply({
      content: `✅ Created private reminder thread for ${userCombo(member, userId)} in <#${thread.id}>.`,
    });
  } catch (error) {
    logger.error(error, `Error creating reminder thread for user ${userId}:`);
    await interaction.editReply({
      content: '❌ An error occurred while creating the reminder thread. Please check bot permissions.',
    });
  }
}

export default handleRemind;
