import type { ClientEvents } from 'discord.js';

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { AbstractRegistry } from '../../structures';
import { AppLogger } from '../logger';

export const eventsFolder = join(__dirname, process.env.EVENTS_FOLDER || '../../events');

type EventHandler<K extends keyof ClientEvents> = {
  name: string;
  event: K;
  execute: (...args: ClientEvents[K]) => Promise<void>;
};

class EventRegistryClass extends AbstractRegistry<EventHandler<keyof ClientEvents>> {
  protected _logger = AppLogger.get('discord').child('EventRegistry');

  public async initialize(): Promise<void> {
    if (this._initialized) {
      this._logger.warn('Event registry is already initialized. Skipping initialization.');
      return;
    }

    await this.loadAll();
    this._initialized = true;
  }

  public async load(name: string, customPath?: string): Promise<EventHandler<keyof ClientEvents> | boolean> {
    try {
      this._logger.info(`Loading event: ${name}`);

      let filePath = customPath || join(eventsFolder, `${name}.ts`);
      let exists = await Bun.file(filePath).exists();

      if (!exists && !customPath) {
        // Fallback: check for directory index (src/events/<name>/index.ts)
        const dirIndexPath = join(eventsFolder, name, 'index.ts');
        if (await Bun.file(dirIndexPath).exists()) {
          filePath = dirIndexPath;
          exists = true;
        }
      }

      const pathName = filePath.split('/').slice(-2).join('/');

      if (!exists) {
        this._logger.error(
          {
            expected: name,
            file: pathName,
          },
          `Event file not found for '${name}'. Attempted to load from '${pathName}'. Skipping...`,
        );
        this._seen.delete(name);
        return false;
      }

      this._logger.trace('Deleting require cache for event file');
      let eventModule = null;
      try {
        eventModule = await import(filePath);
      } catch (_) {
        this._logger.error(
          _,
          `Failed to import event file for '${name}'. Attempted to load from '${pathName}'. Skipping...`,
        );
        this._seen.delete(name);
        return false;
      }

      const event = eventModule.default;
      if (!event || !event.name || !event.event || !event.execute) {
        this._logger.error(
          {
            expected: name,
            file: pathName,
          },
          `Event file for '${name}' is missing required properties. Attempted to load from '${pathName}'. Skipping...`,
        );
        this._seen.delete(name);
        return false;
      }

      this.set(event.name, event);
      this._seen.add(event.name);
      this._unloaded.delete(event.name);

      this._logger.info(`Successfully loaded event: ${event.name}`);
      return event;
    } catch (error) {
      this._logger.error(error, `Error occurred while loading event '${name}':`);
      this._seen.delete(name);
      return false;
    }
  }

  public async loadAll(dir: string = eventsFolder): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          const indexPath = join(fullPath, 'index.ts');
          let isDirModule = false;

          // If directory index default-exports an event handler (e.g. button/index.ts), load it directly
          if (await Bun.file(indexPath).exists()) {
            try {
              const mod = await import(indexPath);
              if (mod?.default?.name && mod?.default?.event && mod?.default?.execute) {
                await this.load(entry.name, indexPath);
                isDirModule = true;
              }
            } catch {
              // Not a single-handler module, continue to recurse
            }
          }

          // Otherwise, recurse to discover all event files in the folder (e.g. message/update.ts, message/delete.ts)
          if (!isDirModule) {
            await this.loadAll(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
          const name = entry.name.slice(0, -3);
          await this.load(name, fullPath);
        }
      }
    } catch (error) {
      this._logger.error(error, 'Error occurred while loading all events:');
    }
  }

  public async unload(name: string): Promise<EventHandler<keyof ClientEvents> | boolean> {
    if (!this.has(name)) {
      this._logger.warn(`Event '${name}' is not loaded. Cannot unload.`);
      return false;
    }

    this.delete(name);
    this._unloaded.add(name);
    this._seen.delete(name);

    this._logger.info(`Successfully unloaded event: ${name}`);
    return true;
  }
}

export const EventRegistry = new EventRegistryClass();
export default EventRegistry;
