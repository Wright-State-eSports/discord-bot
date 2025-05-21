/**
 * Logs all the catched errors
 */
import pino from 'pino';
import { EmbedBuilder, ChannelType } from 'discord.js';

import createTransport, { getFormattedDate } from './transport.js';
import channelList from '../../data/channel-list.json' with { type: 'json' };

const _error = pino(
    {
        level: 'error',
        timestamp: () => `, "time": "${getFormattedDate()}"`
    },
    createTransport('error')
);

/**
 * Error level logging for any caught error
 *
 * Errors will always be informed to a discord channel
 * @param {Error} errorObject The error object that contains data about the error
 * @param {string} message Message to log
 * @param {import('discord.js').Client?} client Client object to be able to send error message to the discord channel
 */
async function error(errorObject, message, client) {
    _error.error(errorObject, message);

    if (client) {
        try {
            const defaultChannels = channelList.logs.default;
            const errorChannels = channelList.logs.error;

            // These are the actual channels being used, convert to set
            // to prevent any repeats in the channels
            let channels = new Set(errorChannels?.length ? errorChannels : defaultChannels);

            channels = client.channels.cache.filter((ch) => {
                // Check if the channel exists and it's a text channel
                return channels.has(ch.id) && ch.type === ChannelType.GuildText;
            });

            const embed = new EmbedBuilder()
                .setTitle('Error Occurred')
                .setColor('Red')
                .addFields({ name: message, value: errorObject.message });

            channels.each((channel) => {
                channel.send({ embeds: [embed] });
            });
        } catch (err) {
            console.error(err, 'Error sending error log to channels');
        }
    }
}

export default error;
