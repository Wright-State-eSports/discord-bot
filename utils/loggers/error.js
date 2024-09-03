/**
 * Logs all the catched errors
 */
import pino from 'pino';
import createTransport, { getFormattedDate } from './transport.js';
import { EmbedBuilder, Client } from 'discord.js';
// import channelList from '../../data/channel-list.json' assert { type: 'json' };

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
 * @param {Client} client Client object to be able to send error message to the discord channel
 */
async function error(errorObject, message /**,client*/) {
    _error.error(errorObject, message);

    // const infoChannels = channelList['logs']['info'] ?? channelList['logs']['default'];
    // if (client) {
    //     const channels = client.channels.cache.filter((ch) => infoChannels.includes(ch.id));
    //     const embed = new EmbedBuilder()
    //         .setColor('Red')
    //         .setTitle('Error Occured')
    //         .addFields({ name: message, value: errorObject.message });

    //     channels.each((channel) => {
    //         channel.send({ embed });
    //     });
    // }
}

export default error;
