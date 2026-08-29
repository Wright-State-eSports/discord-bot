import { Collection } from '@discordjs/collection';

import { type AppLoggerInstance } from '../utils/logger';

/**
 * Abstract base registry class extending Discord.js Collection.
 * Provides tracking for seen, unloaded, and active items with typed lifecycle methods.
 */
export abstract class AbstractRegistry<T> extends Collection<string, T> {
  protected readonly _seen: Set<string> = new Set();
  protected readonly _unloaded: Set<string> = new Set();
  protected abstract readonly _logger: AppLoggerInstance;
  protected _initialized: boolean = false;

  public abstract initialize(): Promise<void>;
  public abstract load(name: string): Promise<T | boolean>;
  public abstract unload(name: string): Promise<T | boolean>;
  public abstract loadAll(): Promise<ReadonlyMap<string, T> | void>;

  public get initialized(): Readonly<boolean> {
    return this._initialized;
  }

  /**
   * @returns a readonly set of seen keys. This is used to track which keys have been loaded.
   */
  public get seen(): ReadonlySet<string> {
    return this._seen;
  }

  /**
   * @returns a readonly set of unloaded keys. This is used to track which keys have been unloaded.
   */
  public get unloaded(): ReadonlySet<string> {
    return this._unloaded;
  }
}

// Re-export alias Registry for convenience
export { AbstractRegistry as Registry };
export default AbstractRegistry;
