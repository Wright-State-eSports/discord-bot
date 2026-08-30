import fs from 'node:fs';
import path from 'node:path';
import pino, { type Logger } from 'pino';
import pinoPretty from 'pino-pretty';

// ==========================================
// 1. Base Logger Setup
// ==========================================
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Direct console pretty stream
const prettyStream = pinoPretty({
  colorize: true,
  messageFormat: '[{breadcrumbs}] {msg}',
  ignore: 'pid,hostname,breadcrumbs,scopes',
});

// Direct synchronous file destinations (Bun compatible, avoiding thread-stream worker threads)
const appLogStream = pino.destination({
  dest: path.join(logsDir, 'app.log'),
  sync: true,
  mkdir: true,
});

const errorLogStream = pino.destination({
  dest: path.join(logsDir, 'error.log'),
  sync: true,
  mkdir: true,
});

const _BASE_PINO = pino(
  {
    level: 'debug',
  },
  pino.multistream([
    { stream: prettyStream, level: 'debug' },
    { stream: appLogStream, level: 'info' },
    { stream: errorLogStream, level: 'error' },
  ]),
);

// Standard pino logger type used by the app.
export type PinoInstance = Logger;

export type TaggedLogFn = pino.LogFn & {
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
export default AppLogger;
