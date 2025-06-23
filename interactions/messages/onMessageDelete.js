import { EmbedBuilder, MessageFlags } from 'discord.js';
import channelList from '../../data/channel-list.json' with { type: 'json' };

/**
 * Logs messages being deleted
 *
 * ! for now, it will only log the messages that are cached
 * ! so if it wasn't cached, it will simply ignore it
 * @param { import('discord.js').Message } message The message that was deleted
 */
async function onMessageDelete(message) {
    // If the message author is null, or the message is a webhook or a bot, ignore it
    if (message?.author == null || message.webhookId || message.author.bot) return;

    const messageAuthorField = `Username: ${message.author.username}
Nickname: ${message.member.nickname}
User @: <@${message.author.id}>
Channel: <#${message.channel.id}>`;

    const embed = new EmbedBuilder()
        .setTitle('Message Deleted')
        .setDescription(
            `*The deleter is by default the author, to confirm check Audit Log using timestamp below*\n\n**Message Content**\n${message.content}`
        )
        .addFields({
            name: 'Message Author',
            value: messageAuthorField,
            inline: false
        })
        .setColor('#f02828')
        .setFooter({
            text: 'Time'
        })
        .setTimestamp();

    // Get the channels to send the message to
    const defaultChannels = channelList.messageLogs;
    const channels = message.client.channels.cache.filter((ch) => defaultChannels.includes(ch.id));

    channels.forEach((channel) => {
        channel.send({ embeds: [embed], flags: [MessageFlags.SuppressNotifications] });
    });
}

export default onMessageDelete;
