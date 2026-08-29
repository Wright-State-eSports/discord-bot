import {
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type MessageEditOptions,
  type TextBasedChannel,
} from 'discord.js';

import { AppLogger, MessageSelection, userCombo } from '../utils';

// Regex to extract channel ID and message ID from Discord message URLs
const MESSAGE_URL_REGEX = /https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(?:\d+|@me)\/(\d+)\/(\d+)/;

/**
 * Admin-only command to edit the content and/or attachment of a bot-authored message.
 * Accepts a message ID, message URL, or a selection made via the "Select Message to Edit" context menu.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('edit-message')
    .setDescription('Edit a message sent by the bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) => option.setName('content').setDescription('The new message content.').setRequired(true))
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The message ID or message URL (optional if selected via context menu).')
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addAttachmentOption((option) =>
      option.setName('attachment').setDescription('A new attachment to include with the message.').setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel the message is located in (optional, defaults to current/selected channel).')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread,
        )
        .setRequired(false),
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'message') {
      const selected = MessageSelection.get(interaction.user.id);
      const choices = [];

      if (selected) {
        const preview = selected.previewContent || selected.messageId;
        choices.push({
          name: `[Selected] "${preview.slice(0, 50)}" (${selected.messageId})`,
          value: selected.messageId,
        });
      }

      await interaction.respond(choices);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const logger = AppLogger.get('discord').child(['command', 'edit-message']);

    const newContent = interaction.options.getString('content', true);
    const messageInput = interaction.options.getString('message');
    const attachment = interaction.options.getAttachment('attachment');
    const channelOption = interaction.options.getChannel('channel') as TextBasedChannel | null;

    let targetMessageId: string | null = null;
    let targetChannelId: string | null = null;

    if (messageInput) {
      const urlMatch = messageInput.match(MESSAGE_URL_REGEX);
      if (urlMatch) {
        targetChannelId = urlMatch[1];
        targetMessageId = urlMatch[2];
      } else {
        targetMessageId = messageInput.trim();
      }
    } else {
      const selected = MessageSelection.get(interaction.user.id);
      if (selected) {
        targetMessageId = selected.messageId;
        targetChannelId = selected.channelId;
      }
    }

    if (!targetMessageId) {
      logger.warn(`${userCombo(interaction)} ran /edit-message with no message specified and no active selection.`);
      await interaction.editReply({
        content:
          '❌ **No message specified or selected!**\n\n' +
          'Either:\n' +
          '1. Provide the `message` option (Message ID or Discord message URL), or\n' +
          '2. Right-click a bot message ➔ **Apps** ➔ **Select Message to Edit** first.',
      });
      return;
    }

    // Resolve channel
    let channel: TextBasedChannel | null = channelOption;
    if (!channel) {
      if (targetChannelId) {
        try {
          channel = (await interaction.client.channels.fetch(targetChannelId)) as TextBasedChannel | null;
        } catch {
          channel = null;
        }
      }

      if (!channel) {
        channel = interaction.channel;
      }
    }

    if (!channel || !channel.isTextBased()) {
      logger.warn(`Could not resolve text channel for message editing.`);
      await interaction.editReply({
        content: '❌ Unable to find or access the text channel containing this message.',
      });
      return;
    }

    if (channel.partial) {
      try {
        channel = await channel.fetch();
      } catch (error) {
        logger.error(error, 'Failed to fetch partial channel for edit-message.');
        await interaction.editReply({
          content: '❌ Failed to fetch the specified channel. Please try again later.',
        });
        return;
      }
    }

    // Fetch target message
    let targetMessage;
    try {
      targetMessage = await channel.messages.fetch(targetMessageId);
    } catch (error) {
      logger.error(error, `Failed to fetch message ${targetMessageId} in channel ${channel.id}`);
      await interaction.editReply({
        content: `❌ Could not find message \`${targetMessageId}\` in ${channel.toString()}. Please ensure the message ID and channel are correct.`,
      });
      return;
    }

    // Validate that the bot authored the message
    if (targetMessage.author.id !== interaction.client.user.id) {
      logger.warn(
        `${userCombo(interaction)} tried to edit message ${targetMessage.id} which is not authored by the bot.`,
      );
      await interaction.editReply({
        content: '❌ You can only edit messages sent by this bot.',
      });
      return;
    }

    // Edit message
    try {
      const payload: MessageEditOptions = {
        content: newContent,
      };

      if (attachment) {
        payload.files = [attachment];
      }

      const editedMessage = await targetMessage.edit(payload);
      MessageSelection.clear(interaction.user.id);

      logger.info(`${userCombo(interaction)} successfully edited message ${targetMessage.id} in ${channel.id}`);
      await interaction.editReply({
        content: `✅ Successfully edited message in ${channel.toString()}!\n[Jump to Message](${editedMessage.url})`,
      });
    } catch (error) {
      logger.error(error, `Error occurred while editing message ${targetMessage.id}`);
      await interaction.editReply({
        content: '❌ An error occurred while editing the message. Please check the bot permissions and logs.',
      });
    }
  },
} satisfies ChatInputCommand;
