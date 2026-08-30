import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type TextBasedChannel,
} from 'discord.js';

import { AppLogger, DiscordLogger, channelCombo, getLatestDraftMessage, userCombo } from '../../utils';

/**
 * Handles button interactions inside the Announcement Studio private thread.
 */
export async function handleAnnounceStudioButton(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'announce-studio']);

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    logger.warn(`${userCombo(interaction)} attempted to use announcement studio button without permission.`);
    await interaction.reply({
      content: '❌ You do not have permission to manage announcements.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const customId = interaction.customId;

  // 1. Send Announcement -> Publish new announcement message to public target channel
  if (customId.startsWith('announce-studio-send')) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const [, targetChannelId] = customId.split(':');

    const thread = interaction.channel;
    if (!thread || !thread.isThread()) {
      await interaction.editReply({ content: '❌ Announcement studio thread not found.' });
      return;
    }

    const draftMessage = await getLatestDraftMessage(thread);
    if (!draftMessage || (!draftMessage.content.trim() && draftMessage.attachments.size === 0)) {
      await interaction.editReply({
        content: '❌ No draft message found to publish. Please type your announcement message in this thread.',
      });
      return;
    }

    const targetChannel = (await interaction.client.channels
      .fetch(targetChannelId)
      .catch(() => null)) as TextBasedChannel | null;

    if (!targetChannel || !targetChannel.isSendable()) {
      await interaction.editReply({
        content: '❌ Target channel could not be found or is not a sendable channel.',
      });
      return;
    }

    try {
      const files = draftMessage.attachments.size > 0 ? Array.from(draftMessage.attachments.values()) : undefined;

      // Send as regular chat message (no embed) with live mentions enabled
      const sent = await targetChannel.send({
        content: draftMessage.content || undefined,
        files,
        allowedMentions: { parse: ['users', 'roles', 'everyone'] },
      });

      logger.info(
        `${userCombo(interaction)} published announcement from studio to ${channelCombo(targetChannel)}: ${sent.url}`,
      );
      await DiscordLogger.log(
        logger.info,
        `${userCombo(interaction)} posted an announcement in ${channelCombo(targetChannel)}: ${sent.url}`,
      );

      const postRows = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('announce-studio-cancel')
          .setLabel('Finish & Delete Thread')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏁'),
      );

      const channelName = 'name' in targetChannel ? targetChannel.name : 'channel';
      await interaction.message.edit({
        content:
          `✅ **Announcement Published to <#${targetChannelId}>!**\n\n` +
          `🔗 **[View Message in #${channelName}](${sent.url})**\n\n` +
          `Type another message in this chat to send another announcement, or click Finish below.`,
        components: [postRows],
      });

      await interaction.editReply({
        content: `✅ Successfully published announcement! ${sent.url}`,
      });
    } catch (error) {
      logger.error(error, `Failed to publish announcement to ${targetChannelId}:`);
      await interaction.editReply({
        content: '❌ Failed to send announcement. Please verify bot permissions in the destination channel.',
      });
    }
    return;
  }

  // 2. Update Announcement -> Apply edits to existing target message
  if (customId.startsWith('announce-studio-update')) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const [, targetChannelId, editMessageId] = customId.split(':');

    const thread = interaction.channel;
    if (!thread || !thread.isThread()) {
      await interaction.editReply({ content: '❌ Announcement studio thread not found.' });
      return;
    }

    const draftMessage = await getLatestDraftMessage(thread);
    if (!draftMessage || (!draftMessage.content.trim() && draftMessage.attachments.size === 0)) {
      await interaction.editReply({
        content: '❌ No draft message found to update. Please type your revised message in this thread.',
      });
      return;
    }

    const targetChannel = (await interaction.client.channels
      .fetch(targetChannelId)
      .catch(() => null)) as TextBasedChannel | null;

    if (!targetChannel || !targetChannel.isSendable()) {
      await interaction.editReply({
        content: '❌ Target channel could not be found or is not a sendable channel.',
      });
      return;
    }

    try {
      const targetMessage = await targetChannel.messages.fetch(editMessageId);
      if (!targetMessage) {
        await interaction.editReply({ content: '❌ Target message could not be found.' });
        return;
      }

      const files = draftMessage.attachments.size > 0 ? Array.from(draftMessage.attachments.values()) : undefined;

      const edited = await targetMessage.edit({
        content: draftMessage.content || undefined,
        files,
        allowedMentions: { parse: ['users', 'roles', 'everyone'] },
      });

      logger.info(
        `${userCombo(interaction)} updated announcement via studio in ${channelCombo(targetChannel)}: ${edited.url}`,
      );
      await DiscordLogger.log(
        logger.info,
        `${userCombo(interaction)} updated an announcement in ${channelCombo(targetChannel)}: ${edited.url}`,
      );

      const postRows = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('announce-studio-cancel')
          .setLabel('Finish & Delete Thread')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏁'),
      );

      const channelName = 'name' in targetChannel ? targetChannel.name : 'channel';
      await interaction.message.edit({
        content:
          `✅ **Announcement Updated in <#${targetChannelId}>!**\n\n` +
          `🔗 **[View Updated Message in #${channelName}](${edited.url})**\n\n` +
          `Type another message in this chat to make further updates, or click Finish below.`,
        components: [postRows],
      });

      await interaction.editReply({
        content: `✅ Successfully updated announcement! ${edited.url}`,
      });
    } catch (error) {
      logger.error(error, `Failed to update announcement ${editMessageId} in ${targetChannelId}:`);
      await interaction.editReply({
        content: '❌ Failed to update announcement. Please check bot permissions.',
      });
    }
    return;
  }

  // 3. Change Destination -> Display Channel Select Menu
  if (customId.startsWith('announce-studio-change-channel')) {
    const [, targetChannelId] = customId.split(':');

    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId('announce-studio-select-channel')
      .setPlaceholder('Select a new destination channel...')
      .setChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.AnnouncementThread,
      );

    const backButton = new ButtonBuilder()
      .setCustomId(`announce-studio-back:${targetChannelId || ''}`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');

    const menuRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

    await interaction.update({
      components: [menuRow, buttonRow],
    });
    return;
  }

  // 4. Back from Channel Selection -> Restore standard initial controls
  if (customId.startsWith('announce-studio-back')) {
    const [, targetChannelId] = customId.split(':');

    const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`announce-studio-change-channel:${targetChannelId || ''}`)
        .setLabel('Change Destination')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📍'),
      new ButtonBuilder()
        .setCustomId('announce-studio-cancel')
        .setLabel('Cancel & Close')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌'),
    );

    await interaction.update({
      components: [controlRow],
    });
    return;
  }

  // 5. Cancel / Finish -> Delete the private thread
  if (customId === 'announce-studio-cancel') {
    await interaction.reply({
      content: '🗑️ Announcement session finished. Deleting studio thread...',
      flags: MessageFlags.Ephemeral,
    });

    const thread = interaction.channel;
    if (thread && thread.isThread()) {
      logger.info(`${userCombo(interaction)} deleted announcement studio thread ${thread.id}`);
      await thread.delete().catch(() => {});
    }
  }
}

export default handleAnnounceStudioButton;
