/**
 * Logs all the catched errors
 */
import pino from 'pino';
import createTransport from './transport.js';

const _error = pino(
    {
        level: 'error',
        timestamp: pino.stdTimeFunctions.isoTime
    },
    createTransport('error')
);

/**
 * Error level logging for any caught error
 *
 * Errors will always be informed to a discord channel
 * @param {Error} errorObject The error object that contains data about the error
 * @param {string} message Message to log
 */
async function error(errorObject, message) {
    _error.error(errorObject, message);
}

export default error;
