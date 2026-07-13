import { DiscordAPIError, EmbedBuilder, WebhookClient } from 'discord.js';
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

// Custom pino type that includes the "success" custom level
type PinoInstance = Logger<'success', boolean>;

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
          return value.bind(target.pinoInstance);
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

let webhook: WebhookClient | null = null;

export async function initDiscordLogger() {
  const hookLogger = new AppLogger('discord-logger');

  if (webhook) {
    hookLogger.warn('Discord webhook is already initialized.');
    return;
  }

  const WEBHOOK_ID = await Config.get('webhook.id');
  const { WEBHOOK_TOKEN } = process.env;

  if (!WEBHOOK_ID || !/^\d{17,19}$/.test(WEBHOOK_ID)) {
    hookLogger.error('Discord webhook id is not set in config.json or is invalid, In Discord logging setup failed.');
    return;
  }

  if (!WEBHOOK_TOKEN) {
    hookLogger.error('Discord webhook token is not set in .env. In Discord logging setup failed.');
    return;
  }

  // Initialize the webhook client
  webhook = new WebhookClient({
    id: WEBHOOK_ID,
    token: WEBHOOK_TOKEN,
  });

  // After initializing, we will first test if ID and Token are valid
  // by sending a test message.
  try {
    const embed = new EmbedBuilder()
      .setTitle('Discord Logger Initialized')
      .setDescription('The Discord logger has been successfully initialized and is now active.')
      .setColor('#3498DB')
      .setTimestamp();

    hookLogger.info('Sending test message to Discord webhook...');
    await webhook.send({ embeds: [embed] });
    hookLogger.info('Test message sent successfully. Discord logger is now active.');
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === 10015) {
      hookLogger.error('Invalid Discord webhook ID or token. Please check your configuration.');
    } else {
      hookLogger.error(error, 'Failed to send test message to Discord webhook.');
    }
  }
}

export const logDiscord: DiscordLoggerFn = async (logger, useEmbeds: boolean, ...args) => {
  const hookLogger = new AppLogger('discord-logger');
  logger(...args); // We will always log to the transports no matter what, because logs are important.

  if (!webhook) {
    hookLogger.error('Discord webhook is not initialized. Please call initDiscordLogger() first.');
    hookLogger.error(
      'We already log to the transports, but the discord webhook will not be triggered defeating the purpose of this logger.',
    );
    return;
  }

  if (!useEmbeds) {
    try {
      await webhook.send({ content: args.join(' ') });
    } catch (error) {
      hookLogger.error(error, 'Failed to send log message to Discord webhook.');
    }
    return;
  }
};
