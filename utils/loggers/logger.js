import info from './info.js';
import error from './error.js';

let _client;

const logger = {
    info,
    error: (errObj, msg) => error(errObj, msg, _client),
    section: {
        START: () => info('====== SECTION START ======'),
        END: () => info('====== SECTION END ======')
    }
};

/**
 * Some intializing, for now it just copies the client
 * so that error can use the client.
 */
// export async function intializeError(client) {
//     _client = client;
// }

export default logger;
