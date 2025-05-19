/**
 * The info logger should be the most used
 * for any and all information (logging everything is important)
 */
import pino from 'pino';
import { ChannelType, Client, EmbedBuilder, MessageFlags } from 'discord.js';

import createTransport, { getFormattedDate } from './transport.js';
import channelList from '../../data/channel-list.json' with { type: 'json' };

const _info = pino(
    {
        level: 'info',
        timestamp: () => `, "time": "${getFormattedDate()}"`
    },
    createTransport('info')
);

/**
 * Info level logging for regular logging
 * @param { string } message Message to log
 * @param { Client? } client Client, if provided, it will send a copy of the logs to the set channels
 */
async function info(message, client, options) {
    _info.info(message);

    if (client) {
        try {
            const defaultChannels = channelList.logs.default;
            const infoChannels = channelList.logs.info;

            // These are the actual channels being used, convert to set
            // to prevent any repeats in the channels
            let channels = new Set(infoChannels?.length ? infoChannels : defaultChannels);

            channels = client.channels.cache.filter((ch) => {
                // Check if the channel exists and it's a text channel
                return channels.has(ch.id) && ch.type === ChannelType.GuildText;
            });

            const embed = new EmbedBuilder()
                .setTitle('Information Log')
                .setColor('#00b0f4')
                .setDescription(message);

            channels.forEach((channel) => {
                channel.send({ embeds: [embed], flags: MessageFlags.Ephemeral });
            });
        } catch (err) {
            console.error(err, 'Error sending info log to channels');
        }
    }
}

export default info;
