import { Collection } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { baseLogger } from './logger';

const logger = baseLogger.child('utils').child('commands');

const commandsFolder = join(__dirname, '../commands');

export const registry = new Collection<string, any>();
export let registryInitialized = false;

/**
 * This is a list of all the commands that exists and valid that has been seen
 * it doesn't necessarily mean that it's loaded into the registry,
 * but it does mean that it exists and is valid. The only time a command is
 * removed from this list is if the file is deleted or becomes invalid.
 */
const _seen = new Set<string>();

/**
 * This is a list of all the commands that have been unloaded from the registry
 * but still exist and are valid. This is used to keep track of commands that
 * have been unloaded so that they can be reloaded later.
 */
export const unloaded: Set<string> = new Set();

/**
 * This proxy is for when something gets deleted in seen,
 * it will also delete it from unloaded. Everything else should stay the same
 */
export const seen = new Proxy(_seen, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);

    if (prop === 'delete' && typeof value === 'function') {
      return (commandName: string) => {
        const deleted = target.delete(commandName);

        if (deleted) unloaded.delete(commandName);

        return deleted;
      };
    }

    if (typeof value === 'function') return value.bind(target);

    return value;
  },
});

export async function loadAllCommands() {
  try {
    logger.info('Loading all commands');
    const files = (await readdir(commandsFolder))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.replace('.ts', ''));

    for (const file of files) {
      await loadCommand(file);
    }

    logger.info('All commands loaded!');
    registryInitialized = true;
    return registry;
  } catch (error) {
    logger.error(error, 'Error occurred while loading commands:');
    throw error;
  }
}

export async function loadCommand(commandName: string): Promise<Command | boolean> {
  try {
    const fileName = `${commandName}.ts`;
    logger.info(`Loading command: ${commandName}`);

    const filePath = join(commandsFolder, `${fileName}`);
    const pathName = filePath.split('/').slice(-2).join('/');

    const file = Bun.file(filePath);
    const exists = await file.exists();

    if (!exists) {
      logger.error(
        {
          expected: commandName,
          file: pathName,
        },
        `Command file not found for '${commandName}'. Attempted to load from '${pathName}'. Skipping...`,
      );
      seen.delete(commandName);
      return false;
    }

    logger.trace('Deleting require cache for command file');
    delete require.cache[require.resolve(filePath)];

    let commandModule = null;
    try {
      commandModule = await require(filePath);
    } catch (_) {
      logger.error(
        _,
        `Failed to import command file for '${commandName}'. Attempted to load from '${pathName}'. Skipping...`,
      );
      seen.delete(commandName);
      return false;
    }

    const command = commandModule.default;

    if (!command) {
      logger.error(`No default export found in '${commandName}'. Skipping...`);
      seen.delete(commandName);
      return false;
    }

    if (!command.data || !command.execute) {
      logger.error(`Command at '${commandName}' is missing 'data' and/or 'execute' properties. Skipping...`);
      seen.delete(commandName);
      return false;
    }

    if (command.data.name !== commandName) {
      logger.error(
        {
          expected: commandName,
          actual: command.data.name,
          file: pathName,
        },
        `Command name mismatch for '${commandName}'. Expected '${commandName}', but got '${command.data.name}'. Skipping...`,
      );
      seen.delete(commandName);
      return false;
    }

    registry.set(command.data.name, command);
    seen.add(command.data.name);
    unloaded.delete(command.data.name);

    logger.info(`Loaded command: ${command.data.name}`);

    return command;
  } catch (error) {
    logger.error(error, `Error occurred while loading command: ${commandName}`);
    throw error;
  }
}

export async function unloadCommand(commandName: string): Promise<Command | boolean> {
  try {
    logger.info(`Unloading command: ${commandName}`);

    const command = registry.get(commandName);

    if (!command) {
      logger.warn(`Command '${commandName}' not found in registry.`);
      return false;
    }

    registry.delete(commandName);
    unloaded.add(commandName);

    logger.info(`Unloaded command: ${commandName}`);

    return command;
  } catch (error) {
    logger.error(error, `Error occurred while unloading command: ${commandName}`);
    throw error;
  }
}
