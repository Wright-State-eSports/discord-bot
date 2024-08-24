/**
 * Wright State University Esports Discord Bot
 *
 * A general purpose discord bot created to
 * simplify tedious jobs around the discord server
 * including:
 * - Member Sign-up
 * - Auto-role
 * - Announcements
 *
 * The bot uses the discord.js module to interact with
 * the discord API
 */
import 'dotenv/config';
import { Events, GatewayIntentBits, Client, Partials } from 'discord.js';

import logger, { intializeError } from './utils/loggers/logger.js';
import newMemberUtils from './utils/new-member.js';
import newMemberData from './data/new-member.json' assert { type: 'json' };
import loadCommands from './utils/loadCommands.js';

// Introductions
logger.info('==============================');
logger.info('     WRIGHT STATE ESPORTS     ');
logger.info('          DISCORD BOT         ');
logger.info('==============================');
logger.info('Booting up...');

logger.info('Creating client...');
const TOKEN = process.env._TOKEN_SECRET;
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

await intializeError(client);

logger.info('Loading commands into client...');
await loadCommands(client);

logger.info('Attaching event listeners...');
client.once(Events.ClientReady, async (ready) => {
    logger.info(`Successfully logged in as ${ready.user.tag}`);
});

/**
 * When any interaction is detected
 */
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const name = interaction.commandName;
    const command = interaction.client.commands.get(name);

    if (!command) await interaction.reply(`No command named ${name}`);

    try {
        await command.execute(interaction);
    } catch (err) {
        logger.error(err, 'Unexpected error on member join!');
    }
});

/**
 * When someone joins the server
 */
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        logger.section.START();
        logger.info(`New member detected! ${member.displayName}`);

        newMemberUtils.addRestrictions(member);

        logger.info('Successfully added permissions on categories');
        logger.section.END();
    } catch (err) {
        logger.error(err, 'Unexpected error on member join!');
    }
});

/**
 * When someone leaves the server (voluntarily or non-voluntarily)
 */
client.on(Events.GuildMemberRemove, async (member) => {});

/**
 * When a member of the server has something updated about them
 * nickname, roles, etc...
 */
client.on(Events.GuildMemberUpdate, async (_old, newMember) => {});

logger.info('Logging in...');
client.login(TOKEN);
