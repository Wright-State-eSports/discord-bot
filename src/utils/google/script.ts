import { AppLogger } from '../logger';
import { accessToken } from './access-token';

export interface GoogleScriptSyncOptions {
  mode: 'approve' | 'disapprove' | 'test';
  name: string;
  rowNum: string | number;
}

/**
 * Sends an approval or disapproval update to the configured Google Apps Script endpoint.
 * Handles token retrieval, bearer authentication, and status logging.
 */
export async function syncRegistrationSheet(options: GoogleScriptSyncOptions): Promise<boolean> {
  const scriptLink = process.env.SCRIPT_LINK;
  if (!scriptLink) {
    return false;
  }

  const isTestOverride = process.env.SCRIPT_TEST?.toLowerCase() === 'true' || process.env.SCRIPT_TEST === '1';
  const effectiveMode = isTestOverride ? 'test' : options.mode;

  const logger = AppLogger.get('google').child('script');
  if (isTestOverride && options.mode !== 'test') {
    logger.info(
      `SCRIPT_TEST is enabled: overriding mode "${options.mode}" with "test" for "${options.name}" (Row ${options.rowNum})`,
    );
  } else {
    logger.info(`Sending ${effectiveMode} update to Google Sheet for "${options.name}" (Row ${options.rowNum})...`);
  }

  try {
    let token = await accessToken.getToken();
    if (!token) {
      logger.warn('Google auth token is missing or expired. Attempting to refresh...');
      token = await accessToken.initToken();
    }

    if (!token) {
      logger.error('Unable to acquire a valid Google auth token. Aborting Google Sheet POST request.');
      return false;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const payload = {
      mode: effectiveMode,
      name: options.name,
      username: options.name,
      rowNum: options.rowNum,
    };

    const res = await fetch(scriptLink, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.status === 200) {
      logger.info(`Successfully synced ${effectiveMode} update to Google Sheet.`);
      return true;
    } else {
      logger.warn(`Google Sheet update returned unexpected status code: ${res.status}`);
      return false;
    }
  } catch (err) {
    logger.error(err, `Failed to update Google Sheet for ${effectiveMode}`);
    return false;
  }
}
