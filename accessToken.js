import { google } from 'googleapis';
import raider from './rowdyraider.json' assert { type: 'json' };
import logger from './utils/loggers/logger.js';

export const accessToken = {
    token: undefined,
    async initToken() {
        logger.info('Initializing auth token...');

        const auth = new google.auth.JWT(
            'rowdy-raider@rowdyraider.iam.gserviceaccount.com',
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
