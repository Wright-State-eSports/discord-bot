import { REST, Routes } from 'discord.js';

import { CommandRegistry } from './command-registry';
import { AppLogger } from './logger';

const logger = AppLogger.get('discord').child('register-commands');

export async function registerCommands() {
  try {
    logger.info('Registering commands');
    logger.info('Getting tokens');
    const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
    if (!DISCORD_TOKEN) throw new Error('No discord token provided');
    if (!CLIENT_ID) throw new Error('No client ID provided');
    if (!GUILD_ID) throw new Error('No guild ID provided');

    if (!CommandRegistry.initialized) {
      logger.warn('Command registry not initialized');
      logger.info('Loading commands');

      await CommandRegistry.loadAll();
    } else logger.info('Command registry initialized, skipping command loading');

    const slashCount = CommandRegistry.slashCommands.size;
    const contextCount = CommandRegistry.contextMenuCommands.size;

    logger.info(
      `Registering ${CommandRegistry.size} application commands (${slashCount} slash, ${contextCount} context menu)`,
    );
    logger.info('Converting objects to JSON');
    const serialized: object[] = CommandRegistry.map((command) => command.data.toJSON());

    const rest = new REST().setToken(DISCORD_TOKEN);

    const data = (await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: serialized,
    })) as unknown as object[];

    logger.info(
      `Successfully registered ${data.length} application commands (${slashCount} slash, ${contextCount} context menu)`,
    );
  } catch (err) {
    logger.error(err, 'Error occurred while registering commands:');
  }
}

// If this script is run directly, register the commands
if (import.meta.main) {
  await registerCommands();
}
