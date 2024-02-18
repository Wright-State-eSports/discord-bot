import info from './info.js';
import error from './error.js';
import fatal from './fatal.js';

const section = {
    start: () => info('====== SECTION START ======'),
    end: () => info('====== SECTION END ======')
};

const logger = {
    info,
    error,
    fatal,
    section
};

export default logger;
