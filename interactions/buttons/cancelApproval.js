import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

import logger from '../../utils/loggers/logger.js';
import newMemberData from '../../data/new-member.json' assert { type: 'json' };
import accessToken from '../../accessToken.js';

/**
 * Cancels the approval of the member
 * @param {import('discord.js').Interaction} interaction
 */
async function cancelApproval(interaction) {
    logger.section.START();
    logger.info('Approve Member pressed');
    logger.info('Getting user data');

    let data = interaction.message.embeds[0];
    let userId = data.fields[1].value.substring(2).replace('>', '');

    let user = await interaction.guild.members.fetch(userId);

    // Raider - 487305397204418560
    // Not Signed Up - 512838063152562194

    logger.info('Attaching appropriate roles...');
    user.roles.add(newMemberData.roles['not-signed-up']);
    user.roles.remove(newMemberData.roles['raider']);

    logger.info('Finished');
    logger.info('Sending updates to sheet');

    let res = await fetch(
        'https://script.google.com/macros/s/AKfycbwDubwP1omJYmNpl5YdetYD8mGG9vGlNG6YYSDwot4/dev',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken.token}`
            },
            body: JSON.stringify({
                mode: 'disapprove',
                username: user.user.username
            })
        }
    );

    console.log(res.status);

    logger.info('Success!');
    logger.info('Updating buttons');

    const engage = interaction.message.components[0].components[1];
    const approve = new ButtonBuilder()
        .setCustomId('approveMember')
        .setLabel('Approve Member')
        .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(approve, engage);

    interaction.update({
        components: [row]
    });

    logger.info('Done');
    logger.section.END();
}

export default cancelApproval;
