import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

import { CommandRegistry, AppLogger, registerCommands, userCombo } from '../utils';

/**
 * Admin-only utility command for managing loaded commands at runtime.
 * Supports listing, loading, unloading, reloading, and pushing commands to the Discord API.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('commands')
    .setDescription('Utility command for managing bot commands.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Admin command only
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List all loaded commands.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reload')
        .setDescription('Reload all commands.')
        .addStringOption((option) =>
          option
            .setName('loaded-command')
            .setDescription('The command to reload.')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('unload')
        .setDescription('Unload a command.')
        .addStringOption((option) =>
          option
            .setName('loaded-command')
            .setDescription('The command to unload.')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('load')
        .setDescription('Load a command.')
        .addStringOption((option) =>
          option
            .setName('unloaded-command')
            .setDescription('The command to load.')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('update')
        .setDescription('Update the commands on Discord API. This is usually done automatically on bot startup.'),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    // We're going to defer the reply because we're doing some async work
    // and we also want all the replies to be ephemeral
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const logger = AppLogger.get('discord').child('command | commands');

    const subcommand = interaction.options.getSubcommand();

    try {
      logger.debug(`${userCombo(interaction)} executing subcommand: ${subcommand}`);
      switch (subcommand) {
        case 'reload':
          await reload(interaction, logger);
          break;

        case 'load':
          await load(interaction, logger);
          break;

        case 'unload':
          await unload(interaction, logger);
          break;

        case 'update':
          await update(interaction, logger);
          break;
      }
    } catch (error) {
      logger.error(error);
      await interaction.editReply({
        content: 'There was an error while executing this command!',
      });
    }
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);

    switch (focusedOption.name) {
      case 'loaded-command': {
        const filtered = CommandRegistry.filter((command) => command.data.name.startsWith(focusedOption.value));
        const choices = filtered.map((command) => ({ name: command.data.name, value: command.data.name }));
        await interaction.respond(choices);
        return;
      }

      case 'unloaded-command': {
        const filtered = Array.from(CommandRegistry.unloaded).filter((commandName) =>
          commandName.startsWith(focusedOption.value),
        );
        const choices = filtered.map((commandName) => ({ name: commandName, value: commandName }));
        await interaction.respond(choices);
        return;
      }
    }
  },
} satisfies ChatInputCommand;

/** Unloads then re-imports a command from disk, picking up any code changes. */
const reload: SubcommandHandler = async (interaction, parentLogger) => {
  const logger = parentLogger.child('reload');

  const commandName = interaction.options.getString('loaded-command', true);

  logger.debug(`Reloading command: ${commandName}`);
  const command = CommandRegistry.find((command) => command.data.name === commandName);

  if (!command) {
    logger.warn(`Command not found: ${commandName}`);
    await interaction.editReply({ content: `Command not found: ${commandName}` });
    return;
  }

  // We'll just use the unload and load helpers
  try {
    const unloadedCommand = await CommandRegistry.unload(commandName);
    if (!unloadedCommand) {
      logger.warn(`Failed to unload command: ${commandName}`);
      await interaction.editReply({ content: `Failed to unload command: ${commandName}` });
      return;
    }

    const loadedCommand = await CommandRegistry.load(commandName);
    if (!loadedCommand) {
      logger.warn(`Failed to load command: ${commandName}`);
      await interaction.editReply({ content: `Failed to load command: ${commandName}` });
      return;
    }

    logger.info(`Successfully reloaded command: ${commandName}`);
    await interaction.editReply({ content: `Successfully reloaded command: ${commandName}` });
  } catch (error) {
    logger.error(error, `Error occurred while reloading command: ${commandName}`);
    await interaction.editReply({ content: `Error occurred while reloading command: ${commandName}` });
  }
};

/** Loads a previously unloaded command back into the registry. */
const load: SubcommandHandler = async (interaction, parentLogger) => {
  const logger = parentLogger.child('load');

  const commandName = interaction.options.getString('unloaded-command', true);

  logger.debug(`Loading command: ${commandName}`);
  if (CommandRegistry.has(commandName)) {
    logger.warn(`Command already loaded: ${commandName}`);
    await interaction.editReply({ content: `Command already loaded: ${commandName}` });
    return;
  }

  try {
    const loadedCommand = await CommandRegistry.load(commandName);
    if (!loadedCommand) {
      logger.warn(`Failed to load command: ${commandName}`);
      await interaction.editReply({ content: `Failed to load command: ${commandName}` });
      return;
    }

    logger.info(`Successfully loaded command: ${commandName}`);
    await interaction.editReply({ content: `Successfully loaded command: ${commandName}` });
  } catch (error) {
    logger.error(error, `Error occurred while loading command: ${commandName}`);
    await interaction.editReply({ content: `Error occurred while loading command: ${commandName}` });
  }
};

/** Removes a command from the registry so it no longer executes (stays registered with Discord). */
const unload: SubcommandHandler = async (interaction, parentLogger) => {
  const logger = parentLogger.child('unload');

  const commandName = interaction.options.getString('loaded-command', true);

  // Make sure this command can't be unloaded, because that would be self-explanatory and won't let us do any
  // hot load and unloads of commands
  if (commandName === 'commands') {
    logger.warn(`${userCombo(interaction)} attempted to unload the 'commands' command, which is not allowed.`);
    await interaction.editReply({ content: `You cannot unload the 'commands' command.` });
    return;
  }

  logger.debug(`Unloading command: ${commandName}`);
  if (!CommandRegistry.has(commandName)) {
    logger.warn(`${userCombo(interaction)} attempted to unload a command that is not loaded: ${commandName}`);
    await interaction.editReply({ content: `Command not found: ${commandName}` });
    return;
  }

  try {
    const unloadedCommand = await CommandRegistry.unload(commandName);
    if (!unloadedCommand) {
      logger.warn(`Failed to unload command: ${commandName}`);
      await interaction.editReply({ content: `Failed to unload command: ${commandName}` });
      return;
    }

    logger.info(`Successfully unloaded command: ${commandName}`);
    await interaction.editReply({ content: `Successfully unloaded command: ${commandName}` });
  } catch (error) {
    logger.error(error, `Error occurred while unloading command: ${commandName}`);
    await interaction.editReply({ content: `Error occurred while unloading command: ${commandName}` });
  }
};

/** Pushes the current set of loaded commands to the Discord API (guild commands). */
const update: SubcommandHandler = async (interaction, parentLogger) => {
  const logger = parentLogger.child('update');

  logger.info('Updating commands on Discord API');

  try {
    await registerCommands();
    logger.info('Successfully updated commands on Discord API');
    await interaction.editReply({ content: 'Successfully updated commands on Discord API' });
  } catch (error) {
    logger.error(error, 'Error occurred while updating commands on Discord API');
    await interaction.editReply({ content: 'Error occurred while updating commands on Discord API' });
  }
};
