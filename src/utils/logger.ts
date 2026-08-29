import {
  DiscordAPIError,
  EmbedBuilder,
  MessageFlags,
  WebhookClient,
  type APIEmbed,
  type HexColorString,
  type WebhookMessageCreateOptions,
} from 'discord.js';
import pino, { type Logger } from 'pino';

import { Config, ConfigKeys } from './config';

// ==========================================
// 1. Base Logger Setup
// ==========================================
const _BASE_PINO = pino({
  level: 'debug',
  transport: {
    targets: [
      // Pretty print to console in development
      {
        target: 'pino-pretty',
        level: 'debug',
        options: {
          colorize: true,
          messageFormat: '[{breadcrumbs}] {msg}',
          ignore: 'pid,hostname,breadcrumbs,scopes',
        },
      },
      {
        target: 'pino/file',
        level: 'info',
        options: {
          destination: `${process.cwd()}/logs/app.log`,
          mkdir: true,
        },
      },
      {
        target: 'pino/file',
        level: 'error',
        options: {
          destination: `${process.cwd()}/logs/error.log`,
          mkdir: true,
        },
      },
    ],
  },
});

// Standard pino logger type used by the app.
type PinoInstance = Logger;

type TaggedLogFn = pino.LogFn & {
  level?: number;
};

// Type intersection to tell your IDE that all pino.Logger functions exist
export type AppLoggerInstance = BaseAppLogger & PinoInstance;

// ==========================================
// 2. Core Logger Class (Internal Implementation)
// ==========================================

class BaseAppLogger {
  private pinoInstance: PinoInstance;
  public readonly path: string[];

  private static _instances: Map<string, AppLoggerInstance> = new Map();

  /**
   * Retrieves an existing logger instance for the given scope or creates a new one if it doesn't exist.
   * @param scope The scope string or array of scopes for which to retrieve or create a logger instance.
   * @returns An instance of BaseAppLogger for the specified scope.
   */
  public static get(scope: string | string[]): AppLoggerInstance {
    const key = Array.isArray(scope) ? scope.join('|') : scope;
    if (this._instances.has(key)) {
      return this._instances.get(key)!;
    }

    const instance = new BaseAppLogger(scope) as unknown as AppLoggerInstance;
    this._instances.set(key, instance);
    return instance;
  }

  constructor(input: string | string[]) {
    if (typeof input === 'string') {
      this.path = [input];
    } else {
      this.path = input;
    }

    this.pinoInstance = _BASE_PINO.child({
      level: 'debug',
      name: this.path[0],
      scopes: this.path,
      breadcrumbs: this.path.slice(1).join('|'),
    });

    // Proxy that merges BaseAppLogger's own methods with the pino instance.
    // Property lookups first check BaseAppLogger (child, path, instance, etc.);
    // anything not found there falls through to the underlying pino logger so
    // callers can use logger.info / logger.error / etc. directly.
    const proxyInstance = new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        const value = Reflect.get(target.pinoInstance, prop);

        if (typeof value === 'function') {
          const bound = value.bind(target.pinoInstance);

          // Attach a numeric `level` property to each log function (info, warn, error…)
          // so DiscordLogger.embed() can read the severity from the function reference
          // itself (e.g. `logger.warn.level === 40`) without needing a separate arg.
          if (typeof prop === 'string' && prop in target.pinoInstance.levels.values) {
            const tagged = bound as TaggedLogFn;
            Object.defineProperty(tagged, 'level', {
              value:
                target.pinoInstance.levels.values[prop as keyof typeof target.pinoInstance.levels.values] ??
                target.pinoInstance.levelVal,
              enumerable: false,
              configurable: true,
            });
            return tagged;
          }

          return bound;
        }

        return value;
      },
    });

    if (typeof input === 'string') {
      BaseAppLogger._instances.set(input, proxyInstance as unknown as AppLoggerInstance);
    } else {
      BaseAppLogger._instances.set(input.join('|'), proxyInstance as unknown as AppLoggerInstance);
    }

    return proxyInstance as unknown as AppLoggerInstance;
  }

  public get instance(): PinoInstance {
    return this.pinoInstance;
  }

  /**
   * Spawns a deeper scoped logger, hitting the internal array constructor overload.
   */
  public child(nextScope: string | string[]): AppLoggerInstance {
    const scopes = Array.isArray(nextScope) ? nextScope : [nextScope];
    return new BaseAppLogger([...this.path, ...scopes]) as unknown as AppLoggerInstance;
  }
}

// ==========================================
// 3. Public Constructor Types
// ==========================================

export interface AppLoggerConstructor {
  // PUBLIC OVERLOADS: Accepts either a single string or an array of strings
  new (scope: string | string[]): AppLoggerInstance;

  get(scope: string | string[]): AppLoggerInstance;
}

/**
 * The AppLoggerConstructor interface defines the constructor signature for creating new logger instances.
 * It allows for creating a logger with a single string or an array of strings for deep initial context.
 *
 * Example usage:
 * ```
 * const logger = new AppLogger(['root', 'subModule', 'service']);
 * ```
 */
export const AppLogger = BaseAppLogger as unknown as AppLoggerConstructor;

// ==========================================
// 4. Discord Logger Implementation
// ==========================================

/**
 * In Discord Logging
 */
export type DiscordLoggerFn = (
  logger: pino.LogFn,
  useEmbeds: boolean,
  ...args: Parameters<pino.LogFn>
) => Promise<void>;

export interface DiscordLogEmbedArgs {
  error?: unknown;
  options?: APIEmbed;
  /** Whether to suppress Discord notifications. Defaults to `true`. */
  quiet?: boolean;
}

export interface DiscordLogMessageArgs {
  error?: unknown;
  /** Whether to suppress Discord notifications. Defaults to `true`. */
  quiet?: boolean;
}

/**
 * Class that handles the in discord logging.
 */
export class DiscordLogger {
  private static readonly LEVEL_COLOR_MAP: Record<number, HexColorString> = {
    30: '#3498DB', // Info
    40: '#f59e0b', // Warn
    50: '#ef4444', // Error
    60: '#b91c1c', // Fatal
  };

  private static readonly LEVEL_NAME_MAP: Record<number, string> = {
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR',
    60: 'FATAL',
  };

  private static webhook: WebhookClient | null = null;
  private static hookLogger = new AppLogger(['discord', 'webhook-logger']);

  /**
   * The entrypoint for initializing the webhook.
   * @returns if initialization is successful or if it's already initialized
   */
  public static async init(): Promise<boolean> {
    if (this.webhook) {
      this.hookLogger.warn('Discord webhook is already initialized.');
      return true;
    }

    const WEBHOOK_ID = await Config.get(ConfigKeys.Webhooks.Logs.Id);
    const LOGGER_WEBHOOK_TOKEN = process.env.LOGGER_WEBHOOK_TOKEN || process.env.WEBHOOK_TOKEN;

    if (!WEBHOOK_ID || !/^\d{17,19}$/.test(WEBHOOK_ID)) {
      this.hookLogger.error(
        'Discord webhook id is not set in config.json or is invalid, In Discord logging setup failed.',
      );
      return false;
    }

    if (!LOGGER_WEBHOOK_TOKEN) {
      this.hookLogger.error(
        'Discord webhook token (LOGGER_WEBHOOK_TOKEN) is not set in .env. In Discord logging setup failed.',
      );
      return false;
    }

    // Initialize the webhook client
    this.webhook = new WebhookClient({
      id: WEBHOOK_ID,
      token: LOGGER_WEBHOOK_TOKEN,
    });

    // After initializing, we will first test if ID and Token are valid
    // by sending a test message.
    try {
      this.hookLogger.info('Sending test message to Discord webhook...');
      await this._sendMessage('▬▬▬▬▬▬▬▬▬▬', MessageFlags.SuppressNotifications);
      await this._sendEmbed(
        'The Discord logger has been successfully initialized and is now active.',
        '#3498DB',
        {
          title: 'Discord Logger Initialized',
        },
        MessageFlags.SuppressNotifications,
      );

      this.hookLogger.info('Test message sent successfully. Discord logger is now active.');
      return true;
    } catch (error) {
      if (error instanceof DiscordAPIError && error.code === 10015) {
        this.hookLogger.error('Invalid Discord webhook ID or token. Please check your configuration.');
      } else {
        this.hookLogger.error(error, 'Failed to send test message to Discord webhook.');
      }
      return false;
    }
  }

  /**
   * Sends an embed to the Discord webhook with the specified message and color.
   * Notifications are suppressed by default; pass `{ quiet: false }` to alert channel members.
   * @param logger The logger function to use for logging.
   * @param msg The message to include in the embed.
   * @param args Optional arguments including error, embed options, and quiet setting.
   */
  public static async embed(logger: TaggedLogFn, msg: string, args?: DiscordLogEmbedArgs) {
    const { error: err, options, quiet = true } = args ?? {};
    const level = logger.level ?? 30;

    // Send the log to the logger first.
    await this._sendToLogger(logger, msg, err);
    await this._sendEmbed(
      msg,
      this.LEVEL_COLOR_MAP[level] ?? '#000000',
      options,
      quiet ? MessageFlags.SuppressNotifications : undefined,
    );
  }

  /**
   * Sends a regular message to the Discord webhook with level prefix: [LEVEL] Message.
   * Notifications are suppressed by default; pass `{ quiet: false }` to alert channel members.
   */
  public static async log(logger: TaggedLogFn, msg: string, args?: { quiet?: boolean }) {
    const { quiet = true } = args ?? {};
    const level = logger.level ?? 30;

    // Send the log to the logger first.
    await this._sendToLogger(logger, msg);
    await this._sendMessage(
      `[${this.LEVEL_NAME_MAP[level] ?? 'UNKNOWN'}] ${msg}`,
      quiet ? MessageFlags.SuppressNotifications : undefined,
    );
  }

  /**
   * Sends a regular message to the Discord webhook.
   * Notifications are suppressed by default; pass `{ quiet: false }` to alert channel members.
   * @param logger The logger function to use for logging.
   * @param msg The message to send.
   * @param args Optional arguments including error and quiet setting.
   */
  public static async message(logger: TaggedLogFn, msg: string, args?: DiscordLogMessageArgs) {
    const { error: err, quiet = true } = args ?? {};

    // Send the log to the logger first.
    await this._sendToLogger(logger, msg, err);
    await this._sendMessage(msg, quiet ? MessageFlags.SuppressNotifications : undefined);
  }

  /**
   * Methods that actually sends the embed to the webhook.
   * @param args Description and color is omitted because they will be required argument.
   */
  private static async _sendEmbed(
    msg: string,
    color: HexColorString,
    args?: Omit<APIEmbed, 'description' | 'color'>,
    flags: WebhookMessageCreateOptions['flags'] = MessageFlags.SuppressNotifications,
  ): Promise<void> {
    if (await this._notInit('_sendEmbed')) return;

    try {
      const embed = EmbedBuilder.from(args ?? {})
        .setDescription(msg)
        .setColor(color)
        .setTimestamp();

      await this.webhook!.send({ embeds: [embed], flags });
    } catch (error) {
      this.hookLogger.error(error, 'Failed to send log message to Discord webhook.');
    }
  }

  private static async _sendMessage(
    msg: string,
    flags: WebhookMessageCreateOptions['flags'] = MessageFlags.SuppressNotifications,
  ): Promise<void> {
    if (await this._notInit('_sendMessage')) return;

    try {
      await this.webhook!.send({ content: msg, flags });
    } catch (error) {
      this.hookLogger.error(error, 'Failed to send log message to Discord webhook.');
    }
  }

  /**
   * Triggers the logger function with the provided message and error.
   */
  private static async _sendToLogger(logger: TaggedLogFn, msg: string, err: unknown = {}): Promise<void> {
    logger(err, msg);
  }

  /**
   * Checks if the webhook is initialized. If not, logs an error and returns true.
   * @returns if webhook is not initialized
   */
  private static async _notInit(ctx: string): Promise<boolean> {
    if (!this.webhook) {
      this.hookLogger.child(ctx).error('Discord webhook is not initialized. Please call init() first.');
      return true;
    }

    return false;
  }
}
