/**
 * The info logger should be the most used
 * for any and all information (logging everything is important)
 */
import pino from 'pino';
import createTransport, { getFormattedDate } from './transport.js';
import channelList from '../../data/channel-list.json' with { type: 'json' };
import { Client, EmbedBuilder } from 'discord.js';

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
async function info(message, client = null, options) {
    _info.info(message);

    if (client) {
        try {
            const defaultChannels = channelList.logs.default;
            const infoChannels = channelList.logs.info;

            // These are the actual channels being used, convert to set
            // to prevent any repeats in the channels
            let channels = new Set(infoChannels?.length ? infoChannels : defaultChannels);

            channels = client.channels.cache.filter((ch) => channels.has(ch.id))

            const embed = new EmbedBuilder()
                .setTitle("Information Log")
                .setDescription(message)
                .setColor("#00b0f4");

            channels.forEach((channel) => {
                channel.send()
            })        

        } catch (err) {

        }


        
    //     const infoChannels = channelList['logs']['info'] ?? channelList['logs']['default'];
    //     const channels = client.channels.cache.filter((ch) => infoChannels.includes(ch.id));

    //     channels.each((channel) => {
    //         channel.send(`INFO: ${message}`);
    //     });
    }
}

export default info;
