import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type ContextMenuCommandInteraction,
  type MessageContextMenuCommandInteraction,
  type UserContextMenuCommandInteraction,
  type Client as BaseClient,
  type Collection,
  type SlashCommandBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type ContextMenuCommandBuilder,
  type SharedSlashCommand,
  ClientEvents,
} from 'discord.js';

import type { AppLoggerInstance } from './utils/logger.ts';

declare global {
  /**
   * The Command interface represents a Discord bot command, including its data, execution logic, and optional autocomplete functionality.
   *
   * Some rules to follow when creating a command:
   * - **The name of the command must be the same as the name of the file it is defined in, without the file extension. (ping command is in `ping.ts` file, etc.)**
   *    - The command loader **WILL IGNORE** any command that does not follow this rule.
   * - The `data` property must be an instance of either `SlashCommandBuilder` or `SlashCommandSubcommandsOnlyBuilder`.
   * - The `execute` method must be an asynchronous function that takes a `ChatInputCommandInteraction` and any additional arguments, returning a Promise<void>.
   * - The optional `autocomplete` method, if provided, must be an asynchronous function that takes an `AutocompleteInteraction` and any additional arguments, returning a Promise<void>.
   */
  interface ChatInputCommand {
    data:
      | SharedSlashCommand
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction, ...args: any[]) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction, ...args: any[]) => Promise<void>;
  }

  interface MessageContextMenuCommand {
    data: ContextMenuCommandBuilder;
    execute: (interaction: MessageContextMenuCommandInteraction, ...args: any[]) => Promise<void>;
  }

  interface UserContextMenuCommand {
    data: ContextMenuCommandBuilder;
    execute: (interaction: UserContextMenuCommandInteraction, ...args: any[]) => Promise<void>;
  }

  type ContextMenuCommand = MessageContextMenuCommand | UserContextMenuCommand;

  type Command = ChatInputCommand | ContextMenuCommand;

  type SubcommandHandler = (
    interaction: ChatInputCommandInteraction,
    logger: AppLoggerInstance,
    ...args: any[]
  ) => Promise<void>;

  interface Client extends BaseClient {
    commands: Collection<string, Command>;
  }

  interface EventHandler<K extends keyof ClientEvents> {
    name: string;
    event: K;
    once?: boolean;
    execute: (...args: ClientEvents[K]) => Promise<void>;
  }
}
