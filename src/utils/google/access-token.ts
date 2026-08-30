import { JWT } from 'google-auth-library';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { AppLogger } from '../logger';

export interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

export class AccessTokenManager {
  private static instance: AccessTokenManager;
  private logger = AppLogger.get('google').child('access-token');

  public token: string | undefined = undefined;
  public lastRefresh: number = 0;

  private scopes: string[] = [
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/spreadsheets.currentonly',
    'https://www.googleapis.com/auth/drive',
  ];

  public static getInstance(): AccessTokenManager {
    if (!AccessTokenManager.instance) {
      AccessTokenManager.instance = new AccessTokenManager();
    }
    return AccessTokenManager.instance;
  }

  /**
   * Checks if the last time the token was refreshed was at least 10 minutes ago
   * and if the token is present.
   */
  public async fresh(): Promise<boolean> {
    if (!this.token) return false;
    const isFresh = (Date.now() - this.lastRefresh) / 1000 / 60 < 10;
    return isFresh;
  }

  /**
   * Refreshes the Google auth token using the service account credentials.
   */
  public async initToken(): Promise<string | undefined> {
    this.logger.info('Refreshing Google auth token...');

    try {
      const credentialsPath = path.resolve(process.cwd(), 'rowdyraider.json');
      if (!existsSync(credentialsPath)) {
        this.logger.warn(
          `Google credentials file not found at ${credentialsPath}. Google Apps Script integration may fail.`,
        );
        return undefined;
      }

      const raw = readFileSync(credentialsPath, 'utf-8');
      const raider = JSON.parse(raw) as ServiceAccountKey;

      if (!raider.client_email || !raider.private_key) {
        this.logger.warn('Google credentials file is missing client_email or private_key.');
        return undefined;
      }

      const auth = new JWT({
        email: raider.client_email,
        key: raider.private_key,
        scopes: this.scopes,
      });

      const response = await auth.getAccessToken();
      if (response.token) {
        this.token = response.token;
        this.lastRefresh = Date.now();
        this.logger.info('Successfully refreshed Google auth token.');
        return this.token;
      } else {
        this.logger.warn('Failed to retrieve token from Google Auth.');
        return undefined;
      }
    } catch (err) {
      this.logger.error(err, 'Error initializing Google auth token');
      return undefined;
    }
  }

  /**
   * Returns a valid access token, refreshing if necessary.
   */
  public async getToken(): Promise<string | undefined> {
    if (!(await this.fresh())) {
      await this.initToken();
    }
    return this.token;
  }
}

export const accessToken = AccessTokenManager.getInstance();
export default accessToken;
