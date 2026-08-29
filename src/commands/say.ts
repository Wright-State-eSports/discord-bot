import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type TextBasedChannel } from 'discord.js';

import { AppLogger } from '../utils';

/**
 * Admin-only command to send a message as the bot to any text channel.
 * Supports optional channel targeting and file attachments.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something. Defaults to current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) => option.setName('message').setDescription('The message to say.').setRequired(true))
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to send the message in.')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.AnnouncementThread,
        ),
    )
    .addAttachmentOption((option) =>
      option.setName('attachment').setDescription('An attachment to send with the message.'),
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const logger = AppLogger.get('discord').child(['command', 'say']);
    const message = interaction.options.getString('message', true);
    const attachment = interaction.options.getAttachment('attachment');
    let channel = (interaction.options.getChannel('channel') as TextBasedChannel | null) ?? interaction.channel;

    if (!message && !attachment) {
      logger.warn('No message or attachment provided for say command.');
      await interaction.editReply({
        content: 'You must provide a message or an attachment to send.',
      });
      return;
    }

    if (!channel || !channel.isTextBased()) {
      await interaction.editReply({
        content: 'The specified channel or the channel this command is being executed in is not a text channel.',
      });
      return;
    }

    if (channel.partial) {
      logger.debug('Channel is partial, attempting to fetch full channel.');
      try {
        channel = await channel.fetch();
      } catch (error) {
        logger.error(error, 'Failed to fetch partial channel.');
        await interaction.editReply({
          content: 'Failed to fetch the specified channel. Please try again later.',
        });
        return;
      }
    }

    const payload = {
      content: message ?? undefined,
      files: attachment ? [attachment] : undefined,
    };

    // One final check to ensure the channel is sendable before attempting to send the message
    if (channel.isSendable()) {
      logger.info(`Sending payload: ${JSON.stringify(payload)}`);
      const sent = await channel.send(payload);
      await interaction.editReply({
        content: `Message sent in ${channel.toString()}. ${sent.url || ''}`,
      });
    } else {
      logger.warn(`Unable to send message to ${channel.id}.`);
      await interaction.editReply({
        content:
          'Unable to send message to the specified channel. Please ensure the bot has permission to send messages in that channel.',
      });
    }
  },
} satisfies ChatInputCommand;
