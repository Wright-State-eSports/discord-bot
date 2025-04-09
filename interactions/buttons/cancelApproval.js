import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

import logger from '../../utils/loggers/logger.js';
import newMemberData from '../../data/new-member.json' with { type: 'json' };
import accessToken from '../../accessToken.js';

/**
 * Cancels the approval of the member
 * @param {import('discord.js').Interaction} interaction
 */
async function cancelApproval(interaction) {
    logger.section.START();
    logger.info('Approve Member pressed');
    logger.info('Getting user data');

    // Find the user using the @ in the embed which is the userid
    let data = interaction.message.embeds[0];
    let userId = data.fields[1].value.substring(2).replace('>', '');

    await interaction.deferUpdate();

    let user = await interaction.guild.members.fetch(userId);
    let embedTitle = interaction.message.embeds[0].title

    logger.info('Checking if guest or member...')

    /**
     * Check if the user is a guest or a member
     * @type {boolean}
     */
    let guest = embedTitle == 'New Guest';

    logger.info('User detected as a ' + (guest ? 'guest' : 'member'));

    logger.info('Attaching appropriate roles...');

    if (guest) {
        // If they are a guest, we don't need to send any update to the sheet
        await user.roles.remove(newMemberData.roles['guest']);
        await user.roles.add(newMemberData.roles['not-signed-up']);
        logger.info('Finished');

    } else {
        // But if they are a member, we need to send an update to the sheet 
        await user.roles.remove(newMemberData.roles['raider']);
        await user.roles.add(newMemberData.roles['not-signed-up']);

        logger.info('Finished');
        logger.info('Sending updates to sheet');

        logger.info('Checking token...');
        if (!(await accessToken.fresh()))  {
            logger.info('Token not fresh... Refreshing');
            await accessToken.initToken();
        }

        let res = await fetch(
            'https://script.google.com/macros/s/AKfycbxDT-veY2NcRZD_yg_lZUQTfR_uzHIG8tRBjZAONTV7/dev',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken.token}`
                },
                body: JSON.stringify({
                    mode: 'disapprove',
                    username: data.fields[0].value,
                    rowNum: data.fields[4].value
                })
            }
        );

        if (res.status == 200) logger.info('Success!');
        else {
            logger.info('Something went wrong: Status code: ' + res.status);
            logger.section.START();
            logger.info('Dumping response');
            logger.info(res);
            logger.section.END();
        }
    }

    logger.info('Updating buttons');

    const engage = interaction.message.components[0].components[1];
    const approve = new ButtonBuilder()
        .setCustomId(guest ? 'approveGuest':  'approveMember')
        .setLabel(guest ? 'Approve Guest' : 'Approve Member')
        .setStyle(guest ? ButtonStyle.Success : ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(approve, engage);

    interaction.editReply({
        components: [row]
    });

    logger.info('Done');
    logger.section.END();
}

export default cancelApproval;
