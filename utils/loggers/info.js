/**
 * The info logger should be the most used
 * for any and all information (logging everything is important)
 */
import pino from 'pino';
import createTransport, { getFormattedDate } from './transport.js';
// import channelList from '../../data/channel-list.json' assert { type: 'json' };
import { Client } from 'discord.js';

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
async function info(message, client = null) {
    _info.info(message);

    // if (client) {
    //     const infoChannels = channelList['logs']['info'] ?? channelList['logs']['default'];
    //     const channels = client.channels.cache.filter((ch) => infoChannels.includes(ch.id));

    //     channels.each((channel) => {
    //         channel.send(`INFO: ${message}`);
    //     });
    // }
}

export default info;
