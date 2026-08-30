import type { AppLoggerInstance } from '../logger';
import type { ConfigKey } from './keys';

import { validateConfig } from './validator';

export * from './keys';
export * from './validator';

/**
 * Manages application configuration with nested path support and automated startup validation.
 */
export class Config {
  private static _config: Record<string, any> | null = null;
  private static _missingKeys: string[] = [];
  private static logger: AppLoggerInstance;

  /**
   * Retrieves the list of missing or empty configuration keys detected during initialization/validation.
   */
  static get missingKeys(): string[] {
    return this._missingKeys;
  }

  static async init() {
    await this._initializeLogger();
    await this.loadConfig();
    this.validate();
  }

  /**
   * Validates the loaded configuration against all defined ConfigKeys.
   * Logs a warning if any required keys are missing or unset.
   *
   * @returns An array of missing dot-delimited key paths.
   */
  static validate(): string[] {
    this._missingKeys = validateConfig(this._config);
    if (this._missingKeys.length > 0) {
      this.logger.warn(
        { missingKeys: this._missingKeys },
        `Configuration warning: ${this._missingKeys.length} required config key(s) are missing or empty: ${this._missingKeys.join(', ')}`,
      );
    }
    return this._missingKeys;
  }

  /**
   * Loads the configuration into memory. If the configuration is already loaded, it does nothing.
   */
  static async loadConfig(): Promise<void> {
    await this._initializeLogger();
    if (this._config) return;

    const configFile =
      process.env.CONFIG_PATH || (process.env.NODE_ENV === 'development' ? 'config.dev.json' : 'config.json');

    try {
      const file = Bun.file(configFile);
      const data = await file.json();
      this._config = data;
    } catch (error) {
      this.logger.error(error, `Failed to load config file '${configFile}'`);
    }
  }

  /**
   * Retrieves a value from the configuration using a dot-separated key path or ConfigKeys path.
   * If the key does not exist, it returns undefined.
   *
   * @param key - The dot-separated key path or ConfigKeys path (e.g. ConfigKeys.Webhooks.Logs.Id).
   * @returns The value associated with the key, or undefined if not found.
   */
  static async get<T = any>(key: ConfigKey): Promise<T | undefined> {
    await this.loadConfig();
    if (!this._config) {
      this.logger.error('Config not loaded after loadConfig call. This should never happen.');
      return undefined;
    }

    const paths = key.split('.');
    return paths.reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), this._config) as T;
  }

  private static async _initializeLogger() {
    if (!this.logger) {
      const { AppLogger } = await import('../logger');
      this.logger = AppLogger.get('config');
    }
  }
}

export default Config;
