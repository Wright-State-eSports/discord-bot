import { ButtonBuilder, ButtonStyle, ActionRowBuilder, ButtonInteraction } from 'discord.js';
import logger from '../../utils/loggers/logger.js';
import newMemberData from '../../data/new-member.json' with { type: 'json' };

/**
 *
 * @param {ButtonInteraction} interaction
 */
async function approveGuest(interaction) {
    logger.section.START();
    logger.info('Approve Guest pressed');
    logger.info('Getting user data');

    let data = interaction.message.embeds[0];
    let userId = data.fields[1].value.substring(2).replace('>', '');

    await interaction.deferUpdate();

    let user = await interaction.guild.members.fetch(userId);
    const helpChannelId = '626872024375230492';

    logger.info('Attaching appropriate roles...');

    await user.roles.add(newMemberData.roles['guest']);
    await user.roles.remove(newMemberData.roles['not-signed-up']);

    logger.info('Finished');

    interaction.client.channels.cache.get(helpChannelId).send(`<@${userId}>, you are set!`);

    logger.info('Success');
    logger.info('Updating buttons');

    const disapprove = new ButtonBuilder()
        .setCustomId('cancelApproval')
        .setLabel('Cancel Approval')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(disapprove);

    interaction.editReply({
        components: [row]
    });

    logger.info('Done!');
    logger.section.END();
}

export default approveGuest;
