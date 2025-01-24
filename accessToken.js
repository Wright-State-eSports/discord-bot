import { google } from 'googleapis';
import raider from './rowdyraider.json' with { type: 'json' };
import logger from './utils/loggers/logger.js';

export const accessToken = {
    token: undefined,
    lastRefresh: Date.now(),
    /**
     *  Checks if the last time the token was refreshed was 
     *  at least 10 minutes ago. It also forces a promise so that
     *  the token refresh has to wait to make sure that this function
     *  finishes first instead of synchronously doing both (which may break)
     * @returns boolean
     */
    async fresh() { 
        const retVal = (Date.now() - this.lastRefresh) / 1000 / 60 < 10
        return new Promise((resolve) => resolve(retVal))
    },
    async initToken() {
        logger.info('Refreshing auth token...');

        const auth = new google.auth.JWT(
            raider.client_email,
            null,
            raider.private_key,
            [
                'https://www.googleapis.com/auth/script.external_request',
                'https://www.googleapis.com/auth/spreadsheets.currentonly',
                'https://www.googleapis.com/auth/drive'
            ],
            null
        );

        this.lastRefresh = Date.now();
        this.token = (await auth.getAccessToken()).token;
    },
};

export default accessToken;
