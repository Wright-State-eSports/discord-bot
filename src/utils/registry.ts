import { Collection } from '@discordjs/collection';

import { type AppLoggerInstance } from './logger';

export abstract class Registry<T> extends Collection<string, T> {
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

  // ? Seen and Unloaded methods. Seen and Unloaded are readonly outside
  // ? of the Registry class as they are just states and should not be modified outside.

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

export default Registry;
