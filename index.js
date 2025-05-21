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
 * including:
 * - Member Sign-up
 * - Auto-role
 * - Announcements
 * - Message edit/delete logging
 * - In-Discord logging
 * - *Sheets webhook integration
 * - *Fun commands for users
 *
 * __Anything with (*) is not implemented yet__
 *
 * The bot uses the discord.js module to interact with
 * the discord API
 *
 * ===========================
 *
 * Guidelines:
 * - All events from discord should be handled in this file
 * - All functions should be in their own module
 * - All functions should be imported into the main index.js file
 * - All functions should be documented with JSDoc
 *
 * This `index.js` file is the main entry point for the bot
 * and handles all the events and interactions, but it does not
 * have the actual functions themselves as they will be imported
 * as  modules.
 *
 * If any events are added, it should be added here
 * as a centralized location and any functions that will handle
 * the events should be imported from their respective modules.
 */
import 'dotenv/config'; // env variables
import { Events, GatewayIntentBits, Client, Partials } from 'discord.js';

// Interactions modules
import {
    approveMember,
    approveGuest,
    cancelApproval,
    onMessageEdit,
    onMessageDelete
} from './interactions/index.js';
import { addRestrictions, initiateApprovalEmbed } from './utils/new-member.js';

// Utilities
import logger from './utils/loggers/logger.js';
import loadCommands from './utils/loadCommands.js';
import token from './accessToken.js';

// Introductions
logger.info('==============================');
logger.info('     WRIGHT STATE ESPORTS     ');
logger.info('          DISCORD BOT         ');
logger.info('==============================');
logger.info('Booting up...');

logger.info('Creating client...');
const TOKEN = process.env._TOKEN_SECRET;
const startTime = new Date();

/**
 * The client is the main entry point for the bot
 *
 * Since the big update discord did to the API, we need to tell the
 * API what we want to have access to and essentially what the bot
 * will be doing. This is done through the intents and partials
 */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Channel, Partials.Message]
});

await token.initToken();

// loads all the commands to discord's rest api
logger.info('Loading commands into client...');
await loadCommands(client);

logger.info('Attaching event listeners...');
client.once(Events.ClientReady, async (ready) => {
    logger.info(
        `Successfully logged in as ${ready.user.tag}. \n\nStarted up in ${Date.now() - startTime}ms`
    );
});

/**
 * When there is a message, we will try to check if it's in a specific channel
 * and if it's a webhook
 */
client.on(Events.MessageCreate, initiateApprovalEmbed);

/**
 * ! When a message is sent before the bot is turned on, the bot doesn't have prior knowledge
 * ! of the message and therefore will have missing data
 * When a message is edited, if it's not a webhook or a bot, we will log the original message
 * and the updated message
 */
client.on(Events.MessageUpdate, onMessageEdit);

/**
 * When a message is deleted, if it's not a webhook or a bot, we will log the message
 * and the channel it was deleted in
 */
client.on(Events.MessageDelete, onMessageDelete);

/**
 * When any interaction is detected
 * @param {Interaction} interaction - The interaction that was created
 */
client.on(Events.InteractionCreate, async (interaction) => {
    // If the interactions is created by a bot role, which the role id is: 562454890568482818, ignore it
    if (!interaction.member.roles.cache.has('546394309688164364')) return;

    if (interaction.isChatInputCommand()) {
        const name = interaction.commandName;
        const command = interaction.client.commands.get(name);

        if (!command) {
            await interaction.reply(`No command named \`${name}\``);
            logger.info(
                `<@${interaction.user.id}> tried to use \`${name}\` command, but it doesn't exist`
            );
        }

        try {
            await command.execute(interaction);
            logger.info(
                `<@${interaction.user.id}> (${interaction.user.username}) used \`${name}\` command` +
                    `in <#${interaction.channel.id}> (${interaction.channel.name})`
            );
        } catch (err) {
            logger.error(err, 'Error executing command');
        }
    } else if (interaction.isButton()) {
        switch (interaction.component.customId) {
            case 'approveMember':
                approveMember(interaction);
                break;
            case 'approveGuest':
                approveGuest(interaction);
                break;
            case 'cancelApproval':
                cancelApproval(interaction);
                break;
        }
    }
});

/**
 * When someone joins the server
 */
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        logger.section.START();
        logger.info(`New member detected! ${member.displayName}`);

        addRestrictions(member);

        logger.info('Successfully added permissions on categories');
        logger.section.END();
    } catch (err) {
        logger.error(err, 'Unexpected error on member join!');
    }
});

/**
 * When someone leaves the server (voluntarily or non-voluntarily)
 */
client.on(Events.GuildMemberRemove, async () => {});

/**
 * When a member of the server has something updated about them
 * nickname, roles, etc...
 */
client.on(Events.GuildMemberUpdate, async (_old) => {});

logger.info('Logging in...');
client.login(TOKEN);

logger.info('Attaching client to logger...');
logger._client = client;
