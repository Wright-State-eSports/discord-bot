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
import { type APIEmbedField, Client as BaseClient, Events, GatewayIntentBits, Partials } from 'discord.js';

import { AppLogger, DiscordLogger, EventRegistry, Config, CommandRegistry, accessToken } from './utils';

// Setting up logger
const logger = new AppLogger('discord').child('main');

// Validate Discord bot token
const { DISCORD_TOKEN } = process.env;
if (!DISCORD_TOKEN) {
  logger.fatal('No DISCORD_TOKEN provided in environment variables. Aborting startup.');
  process.exit(1);
}

// Initializing configuration
await Config.init();
if (Config.missingKeys.length > 0) {
  logger.warn(`Startup config warning: Missing ${Config.missingKeys.length} key(s): ${Config.missingKeys.join(', ')}`);
}

// Initializing Google Auth Token
await accessToken.initToken();

// Initializing In-Discord logging
await DiscordLogger.init();

logger.info('╔══════════════════════════╗');
logger.info('║   WRIGHT STATE ESPORTS   ║');
logger.info('║       DISCORD  BOT       ║');
logger.info('╚══════════════════════════╝');
logger.info('Booting up!');
const timing = {
  start: new Date(),
  setup: 0,
  login: new Date(),
  ready: new Date(),
};

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
    GatewayIntentBits.GuildWebhooks,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
}) as Client;

DiscordLogger.setClient(client);

logger.info('Client setup!');
logger.info('Attaching commands');
await CommandRegistry.initialize();

logger.info('Adding event handlers');

/**
 * Ready Handler
 */
client.once(Events.ClientReady, async (client) => {
  timing.ready = new Date();

  const logged = `Logged in as <@${client.user.id}>(${client.user.tag})!\n\n`;
  const setup = `Setup completed in \`${timing.setup}ms\`\n`;
  const ready = `Bot ready in \`${timing.ready.getTime() - timing.start.getTime()}ms\`\n`;
  const login = `Logged in in \`${timing.login.getTime() - timing.start.getTime()}ms\`\n`;

  const readyFields: APIEmbedField[] = [
    {
      name: 'Commands Loaded',
      value: `**Total:** \`${CommandRegistry.size}\`\n• Slash Commands: \`${CommandRegistry.slashCommands.size}\`\n• Context Menu Commands: \`${CommandRegistry.contextMenuCommands.size}\``,
      inline: true,
    },
    {
      name: 'Events Loaded',
      value: `**Total:** \`${EventRegistry.size}\``,
      inline: true,
    },
  ];

  if (Config.missingKeys.length > 0) {
    readyFields.push({
      name: '⚠️ Missing Configuration Keys',
      value: Config.missingKeys.map((k) => `• \`${k}\``).join('\n'),
      inline: false,
    });
  }

  const logFn = Config.missingKeys.length > 0 ? logger.warn : logger.info;
  await DiscordLogger.embed(logFn, logged + setup + login + ready, {
    options: {
      title: Config.missingKeys.length > 0 ? 'Bot Ready (with Configuration Warnings)' : 'Bot Ready',
      color: Config.missingKeys.length > 0 ? 0xf59e0b : 0x00ff00,
      fields: readyFields,
    },
  });
  logger.info(`Logged in as ${client.user.tag}!`);
  console.log(`Logged in as ${client.user.tag}!`);

  // Sweep and enrich any registration webhooks that arrived while the bot was offline
  const { sweepUnprocessedRegistrations } = await import('./events/new-register');
  await sweepUnprocessedRegistrations(client);
});

logger.info('Adding event handlers');
await EventRegistry.initialize();

for (const event of EventRegistry.values()) {
  logger.info(`Adding event handler for ${event.name}`);
  client.on(event.event, event.execute);
}

timing.setup = new Date().getTime() - timing.start.getTime();
logger.debug(`Setup completed in ${timing.setup}ms`);

timing.login = new Date();
logger.info('Logging in');
await client.login(DISCORD_TOKEN);
