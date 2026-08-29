import type { ClientEvents } from 'discord.js';

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { AppLogger } from '.';
import Registry from './registry';

export const eventsFolder = join(__dirname, process.env.EVENTS_FOLDER || '../events');

type EventHandler<K extends keyof ClientEvents> = {
  name: string;
  event: K;
  execute: (...args: ClientEvents[K]) => Promise<void>;
};

class EventRegistryClass extends Registry<EventHandler<keyof ClientEvents>> {
  protected _logger = AppLogger.get('discord').child('EventRegistry');

  public async initialize(): Promise<void> {
    if (this._initialized) {
      this._logger.warn('Event registry is already initialized. Skipping initialization.');
      return;
    }

    await this.loadAll();
    this._initialized = true;
  }

  public async load(name: string): Promise<EventHandler<keyof ClientEvents> | boolean> {
    try {
      this._logger.info(`Loading event: ${name}`);

      let filePath = join(eventsFolder, `${name}.ts`);
      let exists = await Bun.file(filePath).exists();

      if (!exists) {
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

      if (event.name !== name) {
        this._logger.error(
          {
            expected: name,
            actual: event.name,
            file: pathName,
          },
          `Event name mismatch for '${name}'. Attempted to load from '${pathName}'. Skipping...`,
        );
        this._seen.delete(name);
        return false;
      }

      this.set(event.name, event);
      this._seen.add(name);
      this._unloaded.delete(name);

      this._logger.info(`Successfully loaded event: ${name}`);
      return event;
    } catch (error) {
      this._logger.error(error, `Error occurred while loading event '${name}':`);
      this._seen.delete(name);
      return false;
    }
  }

  public async loadAll(): Promise<void> {
    try {
      const entries = await readdir(eventsFolder, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          const name = entry.name.slice(0, -3); // Remove .ts extension
          await this.load(name);
        } else if (entry.isDirectory()) {
          const indexPath = join(eventsFolder, entry.name, 'index.ts');
          if (await Bun.file(indexPath).exists()) {
            await this.load(entry.name);
          }
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
