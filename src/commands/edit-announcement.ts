import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
  type TextBasedChannel,
  type TextChannel,
} from 'discord.js';

import { AppLogger, MessageSelection, studioThreads, userCombo } from '../utils';

// Regex to extract channel ID and message ID from Discord message URLs
const MESSAGE_URL_REGEX = /https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(?:\d+|@me)\/(\d+)\/(\d+)/;

/**
 * Admin-only command to open an Announcement Studio private thread to draft and edit an existing bot announcement.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('edit-announcement')
    .setDescription('Open an Announcement Studio thread to edit an existing bot announcement.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The message ID or message URL to edit (optional if selected via context menu).')
        .setRequired(false)
        .setAutocomplete(true),
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
    const logger = AppLogger.get('discord').child(['command', 'edit-announcement']);

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      logger.warn(`${userCombo(interaction)} attempted to use /edit-announcement without permissions.`);
      await interaction.editReply({
        content: '❌ You do not have permission to manage announcements.',
      });
      return;
    }

    const messageInput = interaction.options.getString('message');
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
      logger.warn(
        `${userCombo(interaction)} ran /edit-announcement with no message specified and no active selection.`,
      );
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
    let targetChannel: TextBasedChannel | null = channelOption;
    if (!targetChannel) {
      if (targetChannelId) {
        try {
          targetChannel = (await interaction.client.channels.fetch(targetChannelId)) as TextBasedChannel | null;
        } catch {
          targetChannel = null;
        }
      }

      if (!targetChannel) {
        targetChannel = interaction.channel;
      }
    }

    if (!targetChannel || !targetChannel.isTextBased()) {
      logger.warn(`Could not resolve text channel for edit-announcement.`);
      await interaction.editReply({
        content: '❌ Unable to find or access the text channel containing this message.',
      });
      return;
    }

    if (targetChannel.partial) {
      try {
        targetChannel = await targetChannel.fetch();
      } catch (error) {
        logger.error(error, 'Failed to fetch partial channel for edit-announcement.');
        await interaction.editReply({
          content: '❌ Failed to fetch the specified channel. Please try again later.',
        });
        return;
      }
    }

    // Fetch target message
    let targetMessage;
    try {
      targetMessage = await targetChannel.messages.fetch(targetMessageId);
    } catch (error) {
      logger.error(error, `Failed to fetch message ${targetMessageId} in channel ${targetChannel.id}`);
      await interaction.editReply({
        content: `❌ Could not find message \`${targetMessageId}\` in ${targetChannel.toString()}. Please ensure the message ID and channel are correct.`,
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

    const originChannel = interaction.channel as TextChannel | null;
    if (!originChannel || !('threads' in originChannel)) {
      await interaction.editReply({
        content: '❌ Cannot create a private studio thread in this channel.',
      });
      return;
    }

    try {
      const channelName = 'name' in targetChannel ? targetChannel.name : 'channel';
      const threadName = `📝 edit-${channelName}`.slice(0, 100);

      // Create private studio thread
      const thread = await originChannel.threads.create({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Announcement Edit Studio for ${interaction.user.tag}`,
      });

      await thread.members.add(interaction.user.id).catch(() => {});
      studioThreads.set(thread.id, {
        targetChannelId: targetChannel.id,
        editMessageId: targetMessage.id,
        adminId: interaction.user.id,
      });
      MessageSelection.clear(interaction.user.id);

      const editStudioEmbed = new EmbedBuilder()
        .setColor(0x006633)
        .setTitle('📢 Announcement Studio — Edit Mode')
        .setDescription(
          `Welcome to your private Announcement Edit Studio!\n\n` +
            `📍 **Target Channel:** ${targetChannel.toString()}\n` +
            `🔗 **Target Message:** [Jump to Live Message](${targetMessage.url})\n\n` +
            `### 📖 How to Edit\n` +
            `1. **Copy or revise the original content** sent in the message below (use the native **📋 Copy** button on the top-right of the code block).\n` +
            `2. **Type your revised message** directly in this chat.\n` +
            `3. The bot will attach a **🔄 Update Announcement** button below your new draft.\n` +
            `4. Click **🔄 Update Announcement** to apply your changes to the live message in ${targetChannel.toString()}.\n` +
            `5. When finished, click **Finish & Delete Thread** below.`,
        )
        .setFooter({ text: 'Wright State eSports • Announcement Edit Studio' });

      const studioRows = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('announce-studio-cancel')
          .setLabel('Cancel & Close')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌'),
      );

      await thread.send({
        embeds: [editStudioEmbed],
        components: [studioRows],
      });

      if (targetMessage.content?.trim()) {
        const rawCodeBlock = `\`\`\`markdown\n${targetMessage.content.slice(0, 1950)}\n\`\`\``;
        await thread.send({
          content: `📋 **Original Raw Content** *(Hover over top-right of the box to click **Copy**)*:\n${rawCodeBlock}`,
          allowedMentions: { parse: [] },
        });
      }

      logger.info(
        `${userCombo(interaction)} opened Announcement Edit Studio in thread ${thread.id} for message ${targetMessage.id}`,
      );

      await interaction.editReply({
        content: `👉 **Announcement Edit Studio opened!** Head over to <#${thread.id}> to revise your message.`,
      });
    } catch (error) {
      logger.error(error, 'Failed to create Announcement Edit Studio thread:');
      await interaction.editReply({
        content: '❌ Failed to create Announcement Edit Studio thread. Please check bot permissions.',
      });
    }
  },
} satisfies ChatInputCommand;
