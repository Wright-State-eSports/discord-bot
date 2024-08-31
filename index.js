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
import { addRestrictions, initiateApprovalEmbed } from './utils/new-member.js';
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
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildMessages,
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

client.on(Events.MessageCreate, initiateApprovalEmbed);

/**
 * When any interaction is detected
 */
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const name = interaction.commandName;
        const command = interaction.client.commands.get(name);

        if (!command) await interaction.reply(`No command named ${name}`);

        try {
            await command.execute(interaction);
        } catch (err) {
            logger.error(err, 'Unexpected error on member join!');
        }
    } else if (interaction.isButton()) {
        if (interaction.component.customId === 'approveMember') {
            logger.section.START();
            logger.info('Approve Member pressed');
            logger.info('Getting user data');

            let data = interaction.message.embeds[0];
            let userId = data.fields[1].value.substring(2).replace('>', '');

            let user = await interaction.guild.members.fetch(userId);

            // Raider - 487305397204418560
            // Not Signed Up - 512838063152562194
            newMemberData.roles = {
                'not-signed-up': '1278728082311876668',
                'raider': '1278728114616144035'
            };

            logger.info('Attaching appropriate roles...');
            user.roles.add(newMemberData.roles['raider']);
            user.roles.remove(newMemberData.roles['not-signed-up']);

            logger.info('Finished');
            logger.section.END();

            fetch(
                'https://script.googleusercontent.com/macros/echo?user_content_key=GZISSAWbLDA93yKzuveRzuq5bo4cZeq4aNMkVMXFE-rLSOIHhucqm7uoMs3FPY7D97wsow_58kiVo7iIv0C6dms612916w1xm5_BxDlH2jW0nuo2oDemN9CCS2h10ox_1xSncGQajx_ryfhECjZEnFfUzzoqNE0MUw62i8pChcS84Z4oz-iYWShi5sGlS3sNByXAu-XjCrG3pqSQwHidtg&lib=MSwKSujVhP70LHjPtvPRD9f5PjXsBiptZ',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        username: user.user.username
                    })
                }
            );

            interaction.reply({
                content: 'Done!'
            });
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
client.on(Events.GuildMemberRemove, async (member) => {});

/**
 * When a member of the server has something updated about them
 * nickname, roles, etc...
 */
client.on(Events.GuildMemberUpdate, async (_old, newMember) => {});

logger.info('Logging in...');
client.login(TOKEN);
