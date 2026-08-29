import { EmbedBuilder, Events, type Message, type PartialMessage } from 'discord.js';

import { AppLogger, MessageLogSink } from '../../utils';

const logger = AppLogger.get('events').child('message-delete');

/**
 * Event handler for deleted messages (Events.MessageDelete).
 * Logs the deletion details (author, channel, deleted content) to the configured message-log channel.
 */
export default {
  name: 'message-delete',
  event: Events.MessageDelete,
  execute: async (message: Message | PartialMessage): Promise<void> => {
    try {
      // Ignore direct messages
      if (!message.guild) return;

      // If message is a webhook or bot, ignore it
      if (message.webhookId || message.author?.bot) return;

      // If message is uncached / partial without author information, we cannot retrieve who sent it
      if (!message.author) {
        logger.debug(`Uncached message ${message.id} deleted in <#${message.channelId}>. Skipping log.`);
        return;
      }

      const nickname = message.member?.nickname ?? message.member?.displayName ?? 'N/A';
      const authorField = `Username: ${message.author.username}
Nickname: ${nickname}
User @: <@${message.author.id}>
Channel: <#${message.channelId}>`;

      let content = message.content && message.content.trim().length > 0 ? message.content : '*(No text content)*';
      if (content.length > 3500) {
        content = content.slice(0, 3497) + '...';
      }

      const embed = new EmbedBuilder()
        .setTitle('Message Deleted')
        .setDescription(
          `*The deleter is by default the author, to confirm check Audit Log using timestamp below*\n\n**Message Content**\n${content}`,
        )
        .addFields({
          name: 'Message Author',
          value: authorField,
          inline: false,
        })
        .setColor('#f02828')
        .setFooter({ text: 'Time' })
        .setTimestamp(message.createdAt || new Date());

      if (message.attachments && message.attachments.size > 0) {
        const attachmentNames = message.attachments.map((a) => a.name || 'Attachment').join(', ');
        const truncatedAttachments =
          attachmentNames.length > 1024 ? attachmentNames.slice(0, 1021) + '...' : attachmentNames;

        embed.addFields({
          name: `Attachments (${message.attachments.size})`,
          value: truncatedAttachments,
          inline: false,
        });
      }

      await MessageLogSink.send(message.client, { embeds: [embed] });
      logger.debug(`Logged deleted message ${message.id} by ${message.author.tag} in <#${message.channelId}>`);
    } catch (error) {
      logger.error(error, 'Error handling MessageDelete event');
    }
  },
} satisfies EventHandler<Events.MessageDelete>;
