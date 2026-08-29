import { REST, Routes } from 'discord.js';

import { AppLogger } from '../logger';

const logger = AppLogger.get('discord').child('unregister-commands');

export async function unregisterAllCommands() {
  try {
    logger.info('Deleting all commands');
    const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
    if (!DISCORD_TOKEN) throw new Error('No discord token provided');
    if (!CLIENT_ID) throw new Error('No client ID provided');
    if (!GUILD_ID) throw new Error('No guild ID provided');

    const rest = new REST().setToken(DISCORD_TOKEN);

    (await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: [],
    })) as unknown as object[];

    logger.info(`Successfully deleted slash (/) commands`);
  } catch (err) {
    logger.error(err, 'Error occurred while deleting commands:');
  }
}

if (import.meta.main) {
  await unregisterAllCommands();
}
