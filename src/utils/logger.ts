import { DiscordAPIError, EmbedBuilder, WebhookClient, type APIEmbed, type HexColorString } from 'discord.js';
import pino, { type Logger } from 'pino';

import { Config } from './config';

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

  // Note: Constructor signatures/overloads are removed from here
  // and moved to the exported interface below.
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

    // Return the Proxy. No type assertion needed here at runtime.
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        const value = Reflect.get(target.pinoInstance, prop);

        /**
         * If the property is a function, bind it to the pinoInstance to ensure the correct context.
         * This is necessary because pino methods rely on the correct `this` context to function properly.
         * By binding the method to the pinoInstance, we ensure that it behaves as expected when called.
         * This is especially important for methods like `info`, `warn`, `error`, etc., which are used for logging.
         * Without binding, calling these methods could result in unexpected behavior or errors.
         */
        if (typeof value === 'function') {
          const bound = value.bind(target.pinoInstance);

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
  }

  public get instance(): PinoInstance {
    return this.pinoInstance;
  }

  /**
   * Spawns a deeper scoped logger, hitting the internal array constructor overload.
   */
  public child(nextScope: string): AppLoggerInstance {
    // Using type assertion to bypass the internal 'string[]' signature so that only 'string' is allowed from the top level.
    return new BaseAppLogger([...this.path, nextScope]) as unknown as AppLoggerInstance;
  }
}

// ==========================================
// 3. Public Constructor Types
// ==========================================

export interface AppLoggerConstructor {
  // PUBLIC OVERLOAD: Assumes root module creation from a string
  new (scope: string): AppLoggerInstance;
}

/**
 * The AppLoggerConstructor interface defines the constructor signature for creating new logger instances.
 * It allows for creating a logger with a single string scope, which will be used as the root scope for the logger.
 * To use it properly, the parent process should create a logger instance and then use the `child` method to create deeper scoped loggers.
 * This ensures that the logger hierarchy is maintained and that log messages are properly scoped.
 *
 * Example usage:
 * ```
 * const logger = new AppLogger('root');
 * const childLogger = logger.child('childScope');
 * ```
 * This will result in a log looking like this:
 * ```txt
 * [timestamp] LEVEL (BASE_NAME): [root|childScope] message
 * ```
 *
 * This also makes sure the child logger will be garbage collected when it's out of scope \
 * and when the parent logger is garbage collected, preventing memory leaks.
 */
export const AppLogger = BaseAppLogger as unknown as AppLoggerConstructor;
export const baseLogger = new AppLogger('discord');

/**
 * In Discord Logging
 */
export type DiscordLoggerFn = (
  logger: pino.LogFn,
  useEmbeds: boolean,
  ...args: Parameters<pino.LogFn>
) => Promise<void>;

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

  private static webhook: WebhookClient | null = null;
  private static hookLogger = new AppLogger('discord-logger');

  /**
   * The entrypoint for initializing the webhook.
   * @returns if initialization is successful or if it's already initialized
   */
  public static async init(): Promise<boolean> {
    if (this.webhook) {
      this.hookLogger.warn('Discord webhook is already initialized.');
      return true;
    }

    const WEBHOOK_ID = await Config.get('webhook.id');
    const { WEBHOOK_TOKEN } = process.env;

    if (!WEBHOOK_ID || !/^\d{17,19}$/.test(WEBHOOK_ID)) {
      this.hookLogger.error(
        'Discord webhook id is not set in config.json or is invalid, In Discord logging setup failed.',
      );
      return false;
    }

    if (!WEBHOOK_TOKEN) {
      this.hookLogger.error('Discord webhook token is not set in .env. In Discord logging setup failed.');
      return false;
    }

    // Initialize the webhook client
    this.webhook = new WebhookClient({
      id: WEBHOOK_ID,
      token: WEBHOOK_TOKEN,
    });

    // After initializing, we will first test if ID and Token are valid
    // by sending a test message.
    try {
      this.hookLogger.info('Sending test message to Discord webhook...');
      await this._sendEmbed('The Discord logger has been successfully initialized and is now active.', '#3498DB', {
        title: 'Discord Logger Initialized',
      });

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

  public static async embed(logger: TaggedLogFn, msg: string, args?: { error?: unknown; options?: APIEmbed }) {
    const { error: err, options } = args ?? {};
    const level = logger.level ?? 30;

    // Send the log to the logger first.
    await this._sendToLogger(logger, err, msg);
    await this._sendEmbed(msg, this.LEVEL_COLOR_MAP[level] ?? '#000000', options);
  }

  /**
   * Methods that actually sends the embed to the webhook.
   * @param args Description and color is omitted because they will be required argument.
   */
  private static async _sendEmbed(
    msg: string,
    color: HexColorString,
    args?: Omit<APIEmbed, 'description' | 'color'>,
  ): Promise<void> {
    if (await this._notInit('_sendEmbed')) return;

    try {
      const embed = EmbedBuilder.from(args ?? {})
        .setDescription(msg)
        .setColor(color)
        .setTimestamp(); // always set timestamp

      await this.webhook!.send({ embeds: [embed] });
    } catch (error) {
      this.hookLogger.error(error, 'Failed to send log message to Discord webhook.');
    }
  }

  /**
   * Triggers the logger function with the provided message and error.
   */
  private static async _sendToLogger(logger: TaggedLogFn, err: unknown, msg: string) {
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
