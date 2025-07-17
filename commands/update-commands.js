import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { updateCommands } from '../utils/updateCommands.js';
import logger from '../utils/loggers/logger.js';
import { EmbedBuilder } from '@discordjs/builders';

/**
 * @type { import('../typedefs.js').Command }
 */
export default {
    admin: true,
    data: new SlashCommandBuilder()
        .setName('update-commands')
        .setDescription('Updates the commands into the Discord API.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            logger.info('Updating commands...');
            await updateCommands();

            logger.info('Commands updated successfully.');
            await interaction.editReply({
                embeds: [new EmbedBuilder().setDescription('Commands updated successfully!')]
            });
        } catch (error) {
            logger.error('Error updating commands:', error);
            await interaction.editReply('Failed to update commands. Check logs for details.');
        }
    }
};
