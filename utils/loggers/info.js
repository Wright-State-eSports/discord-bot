/**
 * The info logger should be the most used
 * for any and all information (logging everything is important)
 */
import pino from 'pino';
import createTransport from './transport.js';

const _info = pino(
    {
        level: 'info',
        timestamp: pino.stdTimeFunctions.isoTime
    },
    createTransport('info')
);

/**
 * Info level logging for regular logging
 * @param { string } message Message to log
 * @param { boolean? } inform Send a copy of the log to a discord channel
 */
async function info(message, inform = false) {
    _info.info(message);
}

export default info;
