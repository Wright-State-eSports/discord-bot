import { EmbedBuilder, Events, type Message, type PartialMessage } from 'discord.js';

import { AppLogger, MessageLogSink } from '../../utils';

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
      // Resolve partial messages if possible
      if (oldMessage.partial) {
        oldMessage = await oldMessage.fetch().catch(() => oldMessage);
      }
      if (newMessage.partial) {
        newMessage = await newMessage.fetch().catch(() => newMessage);
      }

      // Ignore direct messages
      if (!newMessage.guild && !oldMessage.guild) return;

      // Ignore bots, webhooks, or messages without identifiable author
      const author = newMessage.author ?? oldMessage.author;
      if (!author || author.bot || newMessage.webhookId || oldMessage.webhookId) {
        return;
      }

      // Ignore updates that did not change text content (e.g. link preview unfurls, pins)
      if (oldMessage.content === newMessage.content) {
        return;
      }

      const member = newMessage.member ?? oldMessage.member;
      const nickname = member?.nickname ?? member?.displayName ?? 'N/A';
      const messageId = newMessage.id || oldMessage.id;
      const channelId = newMessage.channelId || oldMessage.channelId;
      const messageUrl = newMessage.url || oldMessage.url;

      const description = `**Click on title to view message**
Username: ${author.username}
Nickname: ${nickname}
User @: <@${author.id}>
Message ID: ${messageId}
Channel: <#${channelId}>`;

      const embed = new EmbedBuilder()
        .setTitle('Message Edited')
        .setURL(messageUrl)
        .setDescription(description)
        .addFields(
          {
            name: 'Original Message',
            value: formatMessageContent(oldMessage.content),
            inline: false,
          },
          {
            name: '――――――――',
            value: '\u200B',
            inline: false,
          },
          {
            name: 'Edited Message',
            value: formatMessageContent(newMessage.content),
            inline: false,
          },
        )
        .setColor('#f5ed00')
        .setFooter({ text: 'Time' })
        .setTimestamp();

      const client = newMessage.client || oldMessage.client;
      await MessageLogSink.send(client, { embeds: [embed] });
      logger.debug(`Logged edited message ${messageId} by ${author.tag} in <#${channelId}>`);
    } catch (error) {
      logger.error(error, 'Error handling MessageUpdate event');
    }
  },
} satisfies EventHandler<Events.MessageUpdate>;

function formatMessageContent(content?: string | null): string {
  if (!content || content.trim().length === 0) {
    return "*(Couldn't fetch message or empty)*";
  }
  if (content.length > 1024) {
    return content.slice(0, 1021) + '...';
  }
  return content;
}
