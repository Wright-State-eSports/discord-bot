import { Message, EmbedBuilder, MessageFlags } from 'discord.js';
import channelList from '../../data/channel-list.json' with { type: 'json' };

/**
 * Handles the message edit event
 * @param {Message} oldMessage The old message before the edit
 * @param {Message} newMessage The new message after the edit
 */
async function onMessageEdit(oldMessage, newMessage) {
    // Since messages before the bot is alive aren't cached, the api
    // will mark that a message data is partial, so we need to fetch it before
    // we can do anything with it
    if (oldMessage.partial) oldMessage = await oldMessage.fetch();
    if (newMessage.partial) newMessage = await newMessage.fetch();

    // Check if the message is from a bot or a webhook
    if (oldMessage.author.bot || oldMessage.webhookId) return;

    //? This is wacked because of how template literals are
    //? being literal, so if we put any spaces in the string
    //? it will break the formatting
    //? Please ignore it
    let description = `**Click on title to view message**
Username: ${oldMessage.author.username} 
Nickname: ${oldMessage.member.nickname} 
User @: <@${oldMessage.author.id}>
Message ID: ${oldMessage.id} 
Channel: <#${oldMessage.channel.id}>`;

    const embed = new EmbedBuilder()
        .setTitle('Message Edited')
        .setURL(oldMessage.url)
        .setDescription(description)
        .addFields(
            {
                name: 'Original Message',
                value: oldMessage.content,
                inline: false
            },
            {
                name: '――――――――',
                value: ' ', // empty space because the field is required
                inline: false
            },
            {
                name: 'Edited Message',
                value: newMessage.content,
                inline: false
            }
        )
        .setColor('#f5ed00')
        .setFooter({
            text: 'Time'
        })
        .setTimestamp();

    // Get the channels to send the message to
    const defaultChannels = channelList.messageLogs;
    const channels = newMessage.client.channels.cache.filter((ch) =>
        defaultChannels.includes(ch.id)
    );

    channels.forEach((channel) => {
        channel.send({ embeds: [embed], flags: [MessageFlags.SuppressNotifications] });
    });
}

export default onMessageEdit;
