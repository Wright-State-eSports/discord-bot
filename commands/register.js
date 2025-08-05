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
                .addChoices(
                    { name: 'Valorant', value: 'valorant' },
                    { name: 'League of Legends', value: 'league' }
                )
        ),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const game = interaction.options.getString('game');
        logger.info(`User ${interaction.user.tag} registering for ${game}.`);
        logger.info('Setting up prefilled form request...');

        const formUrls = {
            valorant:
                'https://docs.google.com/forms/d/e/1FAIpQLSdEuJtc1s5JUx4maggG3MVAPJoJKb-i9zeJ3-93XcyffpbYjw/viewform?usp=pp_url&entry.903914901=',
            league: 'https://docs.google.com/forms/d/e/1FAIpQLSekh7zYekNCQ1D-pEjsHN8OFTbOZDcARX5QeamKk53x9s7rjw/viewform?usp=pp_url&entry.1495248989='
        };

        await interaction.editReply({
            content: `Please fill out the form for ${game}: ${formUrls[game]}${encodeURIComponent(interaction.user.tag)}`,
            ephemeral: true
        });

        logger.section.END();
    }
};
