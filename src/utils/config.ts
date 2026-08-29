import type { ConfigKey } from './config-keys';
import type { AppLoggerInstance } from './logger';

import { debounce } from './utils';

export * from './config-keys';

interface ListenerNode {
  listeners: Set<ConfigChangeListener>;
  children: Map<string, ListenerNode>;
}

export interface ConfigChangeListener {
  (values: [any, any], key?: string): void | Promise<void>;
}

/**
 * Manages application configuration with nested path support,
 * hierarchical event bubbling, and automatic persistence.
 */
export class Config {
  private static _config: Record<string, any> | null = null;
  private static _root: ListenerNode = { listeners: new Set(), children: new Map() };
  private static logger: AppLoggerInstance;

  static async init() {
    await this._initializeLogger();
    await this.loadConfig();
  }

  /**
   * Loads the configuration into memory. If the configuration is already loaded, it does nothing.
   */
  static async loadConfig(): Promise<void> {
    await this._initializeLogger();
    if (this._config) return;

    try {
      const configFile = process.env.NODE_ENV === 'development' ? 'config.dev.json' : 'config.json';
      const file = Bun.file(configFile);
      const data = await file.json();
      this._config = data;
    } catch (error) {
      this.logger.error(error, 'Failed to load config file');
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
    // Walk the nested object one segment at a time; short-circuit to undefined
    // if any intermediate key is missing or not an object.
    return paths.reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), this._config) as T;
  }

  /**
   * Sets a value in the configuration using a dot-separated key path.
   * If the key does not exist, it will be created.
   * After setting the value, it triggers any registered change listeners for that key.
   *
   * @param key - The dot-separated key path or ConfigKeys path.
   * @param value - The value to set for the specified key.
   * @returns A promise that resolves to true if the value was set successfully, or false if there was an error.
   */
  static async set(key: ConfigKey, value: any): Promise<boolean> {
    await this.loadConfig();
    if (!this._config) {
      this.logger.error('Config not loaded after loadConfig call. This should never happen.');
      return false;
    }

    const paths = key.split('.');
    let current = this._config;

    // Walk to the parent object, creating intermediate nodes if they don't exist.
    for (let i = 0; i < paths.length - 1; i++) {
      const part = paths[i];
      current[part] = current[part] || {};
      current = current[part];
    }

    const lastKey = paths.at(-1)!;
    const oldValue = current[lastKey];
    current[lastKey] = value;

    this._save();
    await this._triggerChange(key, oldValue, value);
    return true;
  }

  /**
   * Adds a listener that will be called whenever the _config is updated.
   *
   * The listener will be called with an array containing the old and new values:
   * ```
   * [oldValue, newValue]
   * ```
   *
   * @param listener - The function to call when the configuration changes.
   * @param key - Optional. If provided, the listener will only be called for changes to this specific key or its children.
   * @returns a disposer that can be called to remove the listener.
   */
  static async addChangeListener(listener: ConfigChangeListener, key?: ConfigKey): Promise<(() => void) | boolean> {
    await this.loadConfig();
    if (!this._config) {
      this.logger.error('Config not loaded after loadConfig call. This should never happen.');
      return false;
    }

    const targetNode = key ? this._findOrCreateNode(key) : this._root;
    targetNode.listeners?.add(listener);
    return () => targetNode.listeners?.delete(listener);
  }

  /**
   * Navigates the listener tree and creates nodes if they do not exist.
   */
  private static _findOrCreateNode(key: string): ListenerNode {
    let curr = this._root;
    for (const part of key.split('.')) {
      if (!curr.children.has(part)) {
        curr.children.set(part, { listeners: new Set(), children: new Map() });
      }
      curr = curr.children.get(part)!;
    }
    return curr;
  }

  /**
   * Triggers the change listeners for a given key, bubbling up from the most specific
   */
  private static async _triggerChange(key: string, oldValue: any, newValue: any): Promise<void> {
    const parts = key.split('.');
    const pathStack: ListenerNode[] = [this._root];

    // Trace path from root to leaf
    let curr = this._root;
    for (const part of parts) {
      if (curr.children.has(part)) {
        curr = curr.children.get(part)!;
        pathStack.push(curr);
      } else break;
    }

    // Bubble up: notify from leaf to root (specific -> general)
    for (let i = pathStack.length - 1; i >= 0; i--) {
      for (const listener of pathStack[i].listeners) {
        try {
          await listener([oldValue, newValue], key);
        } catch (error) {
          this.logger.error(error, `Listener error at path: ${key}`);
        }
      }
    }
  }

  /**
   * Debounced save function to prevent excessive writes to disk.
   * It will wait for 1 second of inactivity before saving the config.
   */
  private static _save = debounce(async () => {
    this.logger.info('Saving config.json...');
    await this._writeConfig();
  }, 1000);

  /**
   * The actual write being performed
   */
  private static async _writeConfig(): Promise<void> {
    // If the config wasn't loaded, then there's no point in writing it back to disk.
    if (!this._config) return;

    try {
      // Always persist to config.json regardless of NODE_ENV — dev changes
      // are intentional writes and should survive restarts.
      const file = Bun.file('config.json');
      await file.write(JSON.stringify(this._config, null, 2));
    } catch (error) {
      this.logger.error(error, 'Failed to save config.json');
    }
  }

  private static async _initializeLogger() {
    if (!this.logger) {
      const { AppLogger } = await require('./logger');
      this.logger = new AppLogger('config');
    }
  }
}

export default Config;
