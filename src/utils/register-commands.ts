import { REST, Routes } from 'discord.js';

import { loadAllCommands, registry, registryInitialized } from './commands';
import { baseLogger } from './logger';

const logger = baseLogger.child('register-commands');

export async function registerCommands() {
  try {
    logger.info('Registering commands');
    logger.info('Getting tokens');
    const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
    if (!DISCORD_TOKEN) throw new Error('No discord token provided');
    if (!CLIENT_ID) throw new Error('No client ID provided');
    if (!GUILD_ID) throw new Error('No guild ID provided');

    if (!registryInitialized) {
      logger.warn('Command registry not initialized');
      logger.info('Loading commands');

      await loadAllCommands();
    } else logger.info('Command registry initialized, skipping command loading');

    logger.info(`Registering ${registry.size} slash (/) commands`);
    logger.info('Converting objects to JSON');
    const serialized: object[] = registry.map((command) => command.data.toJSON());

    const rest = new REST().setToken(DISCORD_TOKEN);

    const data = (await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: serialized,
    })) as unknown as object[];

    logger.info(`Successfully registered ${data.length} slash (/) commands`);
  } catch (err) {
    logger.error(err, 'Error occurred while registering commands:');
  }
}

// If this script is run directly, register the commands
if (import.meta.main) {
  await registerCommands();
}
