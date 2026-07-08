/**
 * Wright State University eSports
 * Discord Bot
 *
 * ===========================
 * Contributors:
 * @author Joshua Quaintance
 * ===========================
 *
 * A general purpose discord bot created to
 * simplify tedious jobs around the discord server
 * including but not limited to:
 * - Member Sign-up
 * - Auto-role
 * - Announcements
 * - Message edit/delete logging
 * - In-Discord logging
 *
 * The bot uses the discord.js module to interact with
 * the discord API
 *
 * ===========================
 *
 * Guidelines:
 * - All events from discord should be handled in this file
 * - All functions should be in their own module
 * - All functions should be imported into the main.ts file
 *
 * This `main.ts` file is the main entry point for the bot
 * and handles all the events and interactions, but it does not
 * have the actual functions themselves as they will be imported
 * as  modules.
 *
 * If any events are added, it should be added here
 * as a centralized location and any functions that will handle
 * the events should be imported from their respective modules.
 */
import { Client as BaseClient, Events, GatewayIntentBits, Partials } from 'discord.js';

import autocompleteHandler from './events/autocomplete';
import commandHandler from './events/command';
import { baseLogger } from './utils';
import { loadAllCommands } from './utils/commands';

const logger = baseLogger.child('index');

logger.info('╔════════════════════════╗');
logger.info('║  WRIGHT STATE ESPORTS  ║');
logger.info('║      DISCORD  BOT      ║');
logger.info('╚════════════════════════╝');
logger.info('Booting up!');
const timing = {
  start: new Date(),
  ready: undefined as Date | undefined,
};

logger.info('Setting up Discord token');
const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  logger.error('No token provided');
  throw new Error('No token provided');
}

logger.info('Token set!');
logger.info('Creating client with intents');

const client = new BaseClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
}) as Client;

logger.info('Client setup!');
logger.info('Attaching commands');
client.commands = await loadAllCommands();

logger.info('Adding event handlers');

/**
 * Ready Handler
 */
client.once(Events.ClientReady, (client) => {
  timing.ready = new Date();
  logger.info(`Ready in ${timing.ready.getTime() - timing.start.getTime()}ms`);
  logger.info(`Logged in as ${client.user.tag}!`);
});

/**
 * Comand Handler
 */
client.on(Events.InteractionCreate, commandHandler);

/**
 * Autocomplete Handler
 */
client.on(Events.InteractionCreate, autocompleteHandler);

logger.debug(`Setup completed in ${new Date().getTime() - timing.start.getTime()}ms`);
logger.info('Logging in');
await client.login(DISCORD_TOKEN);
