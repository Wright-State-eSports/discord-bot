import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import logger from './loggers/logger.js';
import loadCommands from './loadCommands.js';

async function updateCommands() {
    try {
        const rest = new REST().setToken(process.env._TOKEN_SECRET);
        const CLIENT_ID = process.env.CLIENT_ID;
        const commandsArr = await loadCommands();

        logger.section.START();
        logger.info(`Started refreshing ${commandsArr.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsArr });

        logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
        logger.section.END();
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        logger.error(error, 'Unexpected error during updating slash commands');
    }
}

await updateCommands();
