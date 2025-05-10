import { Message, EmbedBuilder, MessageFlags } from 'discord.js';
import channelList from '../../data/channel-list.json' with { type: 'json' };

/**
 * Logs messages being deleted
 *
 * ! for now, it will only log the messages that are cached
 * ! so if it wasn't cached, it will simply ignore it
 * @param {Message} message The message that was deleted
 */
async function onMessageDelete(message) {
    if (message?.author == null) return;

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

/**
    const fetchAuditLogs = await message.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MessageDelete
    });
    const auditLog = fetchAuditLogs.entries.first();
    const { extra: channel, targetId, executorId, target } = auditLog;
    console.log(target);

    // Get the target and executor members
    const targetUser = await message.guild.members.get(target.id);
    const executor = await message.guild.members.get(executorId);

    // Field value for message author
    const messageAuthorField = `Username: ${targetUser.user.username}
Nickname: ${targetUser.nickname}
User @: <@${targetUser.user.id}>
Channel: <#${channel.id}>`;

    // Field value for message deletor
    // If the executor is the author of the message, we will just put author
    let messageDeletorField = 'Author';

    // If the executor is not the author, we will put the executor info
    if (executor.user.id != targetUser.user.id) {
        messageDeletorField = `Username: ${executor.user.username}
Nickname: ${executor.nickname}
User @: <@${executor.user.id}>`;
    }

    const embed = new EmbedBuilder()
        .setTitle('Message Deleted')
        .setDescription(`**Message Content**\n${message.content || 'Message was not cached'}`)
        .addFields(
            {
                name: 'Message Author',
                value: messageAuthorField,
                inline: false
            },
            {
                name: 'Deleted By',
                value: messageDeletorField,
                inline: false
            }
        )
        .setColor('#f02828')
        .setFooter({
            text: 'Time'
        })
        .setTimestamp();

    // Get the channels to send the message to
    const defaultChannels = channelList.messageLogs;
    const channels = message.client.channels.cache.filter((ch) => defaultChannels.includes(ch.id));

    channels.forEach((channel) => {
        channel.send({ embeds: [embed] });
    });
    */
