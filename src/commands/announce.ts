import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
  type TextBasedChannel,
  type TextChannel,
} from 'discord.js';

import { AppLogger, studioThreads, userCombo } from '../utils';

/**
 * Admin command to open a private Announcement Studio thread for drafting,
 * live previewing, and publishing announcements directly via chat.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Open a private Announcement Studio thread to draft and preview announcements in chat.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The destination channel to publish the announcement in (defaults to current channel).')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.AnnouncementThread,
        ),
    ),

  async execute(interaction) {
    const logger = AppLogger.get('discord').child(['command', 'announce']);

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      logger.warn(`${userCombo(interaction)} attempted to use /announce without Administrator permissions.`);
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetChannel = (interaction.options.getChannel('channel') as TextBasedChannel | null) ?? interaction.channel;

    if (!targetChannel || !targetChannel.isSendable()) {
      await interaction.reply({
        content: '❌ Destination channel is not a valid text-based channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const originChannel = interaction.channel as TextChannel | null;
    if (!originChannel || !('threads' in originChannel)) {
      await interaction.reply({
        content: '❌ Cannot create a private thread in this channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const channelName = 'name' in targetChannel ? targetChannel.name : 'channel';
      const threadName = `📝 studio-${channelName}`.slice(0, 100);

      // Create private, non-invitable studio thread
      const thread = await originChannel.threads.create({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Announcement Studio for ${interaction.user.tag}`,
      });

      await thread.members.add(interaction.user.id).catch(() => {});
      studioThreads.set(thread.id, { targetChannelId: targetChannel.id, adminId: interaction.user.id });

      const studioEmbed = new EmbedBuilder()
        .setColor(0x006633)
        .setTitle('📢 Announcement Studio')
        .setDescription(
          `Welcome to your private Announcement Studio!\n\n` +
            `📍 **Destination Channel:** ${targetChannel.toString()}\n\n` +
            `### 📖 How to Use\n` +
            `1. **Type your announcement directly in this chat.** You can use full Markdown formatting, headings (\`#\`, \`##\`), bullet lists, custom emojis, images/attachments, and inline \`@mentions\`.\n` +
            `2. The bot will attach a **🚀 Send Announcement** button directly below your message.\n` +
            `3. You can edit your message in Discord or send a new one at any time before clicking send.\n` +
            `4. Click **🚀 Send Announcement** when ready to publish it directly to ${targetChannel.toString()} as a standard chat message with live pings.\n` +
            `5. You can repeat this process to send multiple announcements in sequence. When you are done, click **Finish & Delete Thread**.\n\n` +
            `### ⚠️ Important Quirks & Gotchas\n` +
            `• **Mention Visibility Quirk:** In Discord, if you \`@mention\` a person or role that has permission to see the parent channel where this thread was created, Discord client-side may automatically grant them visibility into this private thread. To ensure 100% draft privacy, always run \`/announce\` inside an admin-only channel!\n` +
            `• **Changing Destination Channel:** Use the **Change Destination** button below anytime. Switching the destination channel applies to all future messages sent during this studio session.\n` +
            `• **Native Formatting:** Messages are published as native Discord chat messages (no embeds) so that custom formatting, user mentions, and role pings function organically.`,
        )
        .setFooter({ text: 'Wright State eSports • Announcement Studio' });

      const studioRows = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`announce-studio-change-channel:${targetChannel.id}`)
          .setLabel('Change Destination')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📍'),
        new ButtonBuilder()
          .setCustomId('announce-studio-cancel')
          .setLabel('Cancel & Close')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌'),
      );

      await thread.send({
        embeds: [studioEmbed],
        components: [studioRows],
      });

      logger.info(`${userCombo(interaction)} opened Announcement Studio in thread ${thread.id} for #${channelName}`);

      await interaction.editReply({
        content: `👉 **Announcement Studio created!** Head over to <#${thread.id}> and type your announcement in chat.`,
      });
    } catch (error) {
      logger.error(error, 'Failed to create Announcement Studio thread:');
      await interaction.editReply({
        content:
          '❌ Failed to create Announcement Studio thread. Please ensure the bot has permission to create private threads.',
      });
    }
  },
} satisfies ChatInputCommand;
