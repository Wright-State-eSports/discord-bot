import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import logger from '../utils/loggers/logger.js';
import accessToken from '../accessToken.js';

/**
 * @type {import('../typedefs.js').Command}
 */
export default {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register for tryouts for a certain game.')
        .addStringOption((option) =>
            option
                .setName('game')
                .setDescription('The game you want to register for.')
                .setRequired(true)
                .addChoices({ name: 'Valorant', value: 'valorant' })
        ),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const game = interaction.options.getString('game');
        logger.info(`User ${interaction.user.tag} registering for ${game}.`);

        logger.info('Getting pre-filled form...');

        logger.section.START();
        logger.info('Checking token...');
        if (!(await accessToken.fresh())) {
            logger.info('Token not fresh... Refreshing');
            await accessToken.initToken();
        }

        await interaction.editReply('Getting form... Please wait.');

        let res = await fetch(
            `https://script.google.com/macros/s/AKfycbzpzOZfih6BYnx0U0vc-JMI9nvtzT_4xW1QeNQXNWhcQiWi0HJKckdx-c0PoAwvTUDS2w/exec?discordId=${interaction.user.tag}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken.token}`
                }
            }
        );

        if (res.status == 200) {
            let data = await res.json();
            logger.info('Pre-filled form received successfully.');
            logger.info('Sending form to user...');

            const formUrl = data.body.link;
            await interaction.editReply({
                content: `Please fill out the form for ${game}: ${formUrl}`,
                ephemeral: true
            });
        } else {
            logger.info('Failed to get pre-filled form');

            await interaction.editReply({
                content: 'There was an error retrieving the form. Please try again later.',
                ephemeral: true
            });
        }

        logger.section.END();
    }
};
