import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { AppLogger } from './logger';
import Registry from './registry';

export const commandsFolder = join(__dirname, process.env.COMMANDS_FOLDER || '../commands');
export const contextMenusFolder = join(__dirname, process.env.CONTEXT_MENUS_FOLDER || '../context-menus');

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

  public async load(name: string, folder: string = commandsFolder): Promise<Command | boolean> {
    try {
      const fileName = `${name}.ts`;
      this._logger.info(`Loading command: ${name} from ${folder}`);

      let filePath = join(folder, fileName);
      if (!existsSync(filePath)) {
        // If not found in the given folder, try the other folder
        const fallbackFolder = folder === commandsFolder ? contextMenusFolder : commandsFolder;
        const fallbackPath = join(fallbackFolder, fileName);
        if (existsSync(fallbackPath)) {
          filePath = fallbackPath;
          folder = fallbackFolder;
        } else {
          const pathName = filePath.split('/').slice(-2).join('/');
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
      }

      const pathName = filePath.split('/').slice(-2).join('/');

      let commandModule = null;
      try {
        // The `?update=` query string busts Bun's module cache so that
        // reload/load always pulls the latest version of the file from disk.
        commandModule = await import(`${filePath}?update=${Date.now()}`);
      } catch (_) {
        this._logger.error(
          _,
          `Failed to import command file for '${name}'. Attempted to load from '${pathName}'. Skipping...`,
        );
        this._seen.delete(name);
        return false;
      }

      const command: Command = commandModule.default;

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

      const isContextMenu =
        command.data instanceof ContextMenuCommandBuilder ||
        ('type' in command.data &&
          (command.data.type === ApplicationCommandType.Message || command.data.type === ApplicationCommandType.User));

      if (isContextMenu) {
        if (!command.data.name) {
          this._logger.error(`Context menu command at '${pathName}' is missing a valid name. Skipping...`);
          this._seen.delete(name);
          return false;
        }
      } else {
        // Enforce kebab-case filename matching for slash commands
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

      if (existsSync(commandsFolder)) {
        const files = (await readdir(commandsFolder))
          .filter((file) => file.endsWith('.ts'))
          .map((file) => file.replace('.ts', ''));

        for (const fileName of files) {
          await this.load(fileName, commandsFolder);
        }
      }

      if (existsSync(contextMenusFolder)) {
        const contextFiles = (await readdir(contextMenusFolder))
          .filter((file) => file.endsWith('.ts'))
          .map((file) => file.replace('.ts', ''));

        for (const fileName of contextFiles) {
          await this.load(fileName, contextMenusFolder);
        }
      }

      this._logger.info(
        `All commands loaded! (${this.slashCommands.size} slash, ${this.contextMenuCommands.size} context menu)`,
      );
      return this;
    } catch (error) {
      this._logger.error(error, 'Error occurred while loading commands:');
      throw error;
    }
  }

  public get slashCommands() {
    return this.filter(
      (cmd) =>
        !(cmd.data instanceof ContextMenuCommandBuilder) &&
        (!('type' in cmd.data) || cmd.data.type === ApplicationCommandType.ChatInput),
    );
  }

  public get contextMenuCommands() {
    return this.filter(
      (cmd) =>
        cmd.data instanceof ContextMenuCommandBuilder ||
        ('type' in cmd.data &&
          (cmd.data.type === ApplicationCommandType.Message || cmd.data.type === ApplicationCommandType.User)),
    );
  }
}

export const CommandRegistry = new CommandRegistryClass();
