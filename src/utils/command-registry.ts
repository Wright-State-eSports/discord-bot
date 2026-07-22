import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { AppLogger } from './logger';
import Registry from './registry';

export const commandsFolder = join(__dirname, process.env.COMMANDS_FOLDER || '../commands');

class CommandRegistryClass extends Registry<Command> {
  protected _logger = AppLogger.get('discord').child('CommandRegistry');

  public async initialize(): Promise<void> {
    if (this._initialized) {
      this._logger.warn('Command registry is already initialized. Skipping initialization.');
      return;
    }

    await this.loadAll();
    this._initialized = true;
  }

  public async load(name: string): Promise<Command | boolean> {
    try {
      const fileName = `${name}.ts`;
      this._logger.info(`Loading command: ${name}`);

      const filePath = join(commandsFolder, `${fileName}`);
      const pathName = filePath.split('/').slice(-2).join('/');

      const file = Bun.file(filePath);
      const exists = await file.exists();

      if (!exists) {
        this._logger.error(
          {
            expected: name,
            file: pathName,
          },
          `Command file not found for '${name}'. Attempted to load from '${pathName}'. Skipping...`,
        );
        this._seen.delete(name);
        return false;
      }

      this._logger.trace('Deleting require cache for command file');
      delete require.cache[require.resolve(filePath)];

      let commandModule = null;
      try {
        commandModule = await require(filePath);
      } catch (_) {
        this._logger.error(
          _,
          `Failed to import command file for '${name}'. Attempted to load from '${pathName}'. Skipping...`,
        );
        this._seen.delete(name);
        return false;
      }

      const command = commandModule.default;

      if (!command) {
        this._logger.error(`No default export found in '${name}'. Skipping...`);
        this._seen.delete(name);
        return false;
      }

      if (!command.data || !command.execute) {
        this._logger.error(`Command at '${name}' is missing 'data' and/or 'execute' properties. Skipping...`);
        this._seen.delete(name);
        return false;
      }

      if (command.data.name !== name) {
        this._logger.error(
          {
            expected: name,
            actual: command.data.name,
            file: pathName,
          },
          `Command name mismatch for '${name}'. Expected '${name}', but got '${command.data.name}'. Skipping...`,
        );
        this._seen.delete(name);
        return false;
      }

      this.set(command.data.name, command);
      this._seen.add(command.data.name);
      this._unloaded.delete(command.data.name);

      this._logger.info(`Loaded command: ${command.data.name}`);

      return command;
    } catch (error) {
      this._logger.error(error, `Error occurred while loading command: ${name}`);
      throw error;
    }
  }

  public async unload(commandName: string): Promise<Command | boolean> {
    try {
      this._logger.info(`Unloading command: ${commandName}`);

      const command = this.get(commandName);

      if (!command) {
        this._logger.warn(`Command '${commandName}' not found in registry.`);
        return false;
      }

      this.delete(commandName);
      this._unloaded.add(commandName);
      this._logger.info(`Unloaded command: ${commandName}`);

      return command;
    } catch (error) {
      this._logger.error(error, `Error occurred while unloading command: ${commandName}`);
      throw error;
    }
  }

  public async loadAll(): Promise<Registry<Command> | void> {
    try {
      this._logger.info('Loading all commands');
      const files = (await readdir(commandsFolder))
        .filter((file) => file.endsWith('.ts'))
        .map((file) => file.replace('.ts', ''));

      for (const fileName of files) {
        await this.load(fileName);
      }

      this._logger.info('All commands loaded!');
      return this;
    } catch (error) {
      this._logger.error(error, 'Error occurred while loading commands:');
      throw error;
    }
  }
}

export const CommandRegistry = new CommandRegistryClass();
