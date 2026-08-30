import { EmbedBuilder, Events, type Message, type PartialMessage } from 'discord.js';

import { AppLogger, MessageLogSink, channelCombo } from '../../utils';

const logger = AppLogger.get('events').child('message-update');

/**
 * Event handler for message edits (Events.MessageUpdate).
 * Logs the edit details (author, channel, previous & new content) to the configured message-log channel.
 */
export default {
  name: 'message-update',
  event: Events.MessageUpdate,
  execute: async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> => {
    try {
      // Resolve newMessage if partial (oldMessage.fetch() would return the new edited content from Discord REST API)
      if (newMessage.partial) {
        newMessage = await newMessage.fetch().catch(() => newMessage);
      }

      // Ignore direct messages
      if (!newMessage.guild && !oldMessage.guild) return;

      // Ignore bots or webhooks
      const author = newMessage.author ?? oldMessage.author;
      if (author?.bot || newMessage.webhookId || oldMessage.webhookId) {
        return;
      }

      // Ignore updates that did not change text content if both have content
      if (oldMessage.content && newMessage.content && oldMessage.content === newMessage.content) {
        return;
      }

      const member = newMessage.member ?? oldMessage.member;
      const nickname = member?.nickname ?? member?.displayName ?? 'N/A';
      const messageId = newMessage.id || oldMessage.id;
      const channelId = newMessage.channelId || oldMessage.channelId;
      const messageUrl = newMessage.url || oldMessage.url;
      const channelDisplay = channelCombo(newMessage.channel || oldMessage.channel, channelId);

      const authorUsername = author ? (author.tag && author.tag !== '0' ? author.tag : author.username) : 'Unknown';

      const authorInfo = author
        ? `Username: ${authorUsername}
Nickname: ${nickname}
User @: <@${author.id}>`
        : `Author: Unknown (uncached message)`;

      const description = `**Click on title to view message**
${authorInfo}
Message ID: ${messageId}
Channel: ${channelDisplay}`;

      const embed = new EmbedBuilder()
        .setTitle('Message Edited')
        .setURL(messageUrl)
        .setDescription(description)
        .addFields(
          {
            name: 'Original Message',
            value: formatMessageContent(oldMessage.content, '*(Previous version could not be retrieved / uncached)*'),
            inline: false,
          },
          {
            name: '――――――――',
            value: '\u200B',
            inline: false,
          },
          {
            name: 'Edited Message',
            value: formatMessageContent(newMessage.content, '*(No text content or could not be retrieved)*'),
            inline: false,
          },
        )
        .setColor('#f5ed00')
        .setFooter({ text: 'Time' })
        .setTimestamp();

      const client = newMessage.client || oldMessage.client;
      await MessageLogSink.send(client, { embeds: [embed] });
      logger.debug(`Logged edited message ${messageId} in <#${channelId}>`);
    } catch (error) {
      logger.error(error, 'Error handling MessageUpdate event');
    }
  },
} satisfies EventHandler<Events.MessageUpdate>;

function formatMessageContent(content?: string | null, fallback = '*(No text content or empty)*'): string {
  if (!content || content.trim().length === 0) {
    return fallback;
  }
  if (content.length > 1024) {
    return content.slice(0, 1021) + '...';
  }
  return content;
}
