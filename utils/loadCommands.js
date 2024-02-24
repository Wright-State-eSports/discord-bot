import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { Collection, Client } from 'discord.js';
import logger from './loggers/logger.js';

/**
 * Loads all the commands putting it into the client
 *
 * @param { Client } client
 * @returns { Promise< import('../typedefs.js').Command[] > }
 */
const loadCommands = async (client) => {
    logger.section.START();
    let commands;
    if (client) {
        client.commands = new Collection();
        /**
         * @type { Collection }
         */
        commands = client.commands;
    }

    const commandsArr = [];

    const files = await readdir(join(process.cwd(), 'commands'));

    for (const file of files) {
        const loc = join(process.cwd(), 'commands', file);
        const check = await stat(loc);

        if (check.isDirectory()) continue;

        /**
         * @type { import('../typedefs.js').Command }
         */
        const command = (await import(loc)).default;

        if ('data' in command && 'execute' in command) {
            if (client) commands.set(command.data.name, command);
            logger.info(`Loading ${command.data.name}`);
            commandsArr.push(command.data.toJSON());
        }
    }

    logger.section.END();
    return commandsArr;
};

export default loadCommands;
