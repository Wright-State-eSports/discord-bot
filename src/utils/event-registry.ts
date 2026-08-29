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
      const fileName = `${name}.ts`;
      this._logger.info(`Loading event: ${name}`);

      const filePath = join(eventsFolder, `${fileName}`);
      const pathName = filePath.split('/').slice(-2).join('/');

      const file = Bun.file(filePath);
      const exists = await file.exists();

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
      const files = await readdir(eventsFolder);
      const eventFiles = files.filter((file) => file.endsWith('.ts'));

      for (const file of eventFiles) {
        const name = file.slice(0, -3); // Remove the .ts extension
        await this.load(name);
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
