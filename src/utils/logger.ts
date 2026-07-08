import pino, { type Logger } from 'pino';

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
        return Reflect.get(target.pinoInstance, prop);
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
