/**
 * The fatal logger should only be used when the error
 * breaks the program and ends the bot from running.
 */
import pino from 'pino';
import createTransport from './transport.js';

const _fatal = pino(
    {
        level: 'fatal',
        timestamp: pino.stdTimeFunctions.isoTime
    },
    createTransport('fatal')
);

/**
 * Fatal level logging
 *
 * Errors will always be informed to a discord channel
 * @param {Error} errorObject The error object that contains data about the error
 * @param {string} message Message to log
 */
async function fatal(errorObject, message) {
    _fatal.fatal(errorObject, message);
}

export default fatal;
