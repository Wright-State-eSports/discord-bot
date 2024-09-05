import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

import logger from '../../utils/loggers/logger.js';
import newMemberData from '../../data/new-member.json' assert { type: 'json' };
import accessToken from '../../accessToken.js';

async function approveMember(interaction) {
    logger.section.START();
    logger.info('Approve Member pressed');
    logger.info('Getting user data');

    let data = interaction.message.embeds[0];
    let userId = data.fields[1].value.substring(2).replace('>', '');

    let user = await interaction.guild.members.fetch(userId);

    // Raider - 487305397204418560
    // Not Signed Up - 512838063152562194
    // Remove the not signed up role and give them the raider role
    logger.info('Attaching appropriate roles...');
    user.roles.add(newMemberData.roles['raider']);
    user.roles.remove(newMemberData.roles['not-signed-up']);

    logger.info('Finished');
    logger.info('Sending updates to sheet');

    let res = await fetch(
        'https://script.google.com/macros/s/AKfycbxDT-veY2NcRZD_yg_lZUQTfR_uzHIG8tRBjZAONTV7/dev',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken.token}`
            },
            body: JSON.stringify({
                mode: 'approve',
                name: data.fields[0].value
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

    logger.info('Success!');
    logger.info('Updating buttons');

    const engage = interaction.message.components[0].components[1];
    // console.log(engage);

    const disapprove = new ButtonBuilder()
        .setCustomId('cancelApproval')
        .setLabel('Cancel Approval')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(disapprove, engage);

    interaction.update({
        components: [row]
    });

    // TODO: Change
    // interaction.reply({
    //     content: 'Done!'
    // });

    logger.info('Done!');
    logger.section.END();
}

export default approveMember;
