import { google } from 'googleapis';
import raider from './rowdyraider.json' with { type: 'json' };
import logger from './utils/loggers/logger.js';

export const accessToken = {
    token: undefined,
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

        this.token = (await auth.getAccessToken()).token;
    }
};

export default accessToken;
