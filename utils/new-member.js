import {
    GuildMember,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    Message
} from 'discord.js';

import Fuse from 'fuse.js';

import logger from '../utils/loggers/logger.js';
import newMemberData from '../data/new-member.json' assert { type: 'json' };

/**
 * Applies restrictions from not being signed up
 *
 * @param { GuildMember } member
 */
export async function addRestrictions(member) {
    member.roles.add(newMemberData['roles']['not-signed-up']);
}

/**
 *
 * @param {Message} message
 * @returns
 */
export async function initiateApprovalEmbed(message) {
    if (message.channelId !== '1280328507905282068' || message.webhookId !== '1280328619704451114')
        return;

    logger.section.START();
    logger.info('Webhook data received... Parsing data');

    try {
        const data = JSON.parse(message.content);

        // Find the user in the discord server
        let notSignedUp = message.guild.roles.cache.find(
            (role) => role.id == newMemberData.roles['not-signed-up']
        );

        let fetchUser = notSignedUp.members;

        const fuse = new Fuse(fetchUser.toJSON(), {
            keys: ['user.username']
        });

        fetchUser = fuse.search(data.username);

        console.log('result');

        console.log(fetchUser);

        logger.info('Parse successful!');

        // User isn't in discord
        if (fetchUser.length === 0) {
            logger.info('User not in discord');
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('User not found in Discord')
                .addFields(
                    { name: 'Name', value: data.name },
                    { name: 'Username', value: data.username },
                    { name: 'WSU Email', value: data.email }
                );

            logger.info('Sending embed');
            message.channel.send({
                content: '▬▬▬▬▬▬▬▬▬▬',
                embeds: [embed]
            });

            // If user does exist in discord
        } else {
            logger.info('User found!');
            const user = fetchUser[0].item.user;

            const embed = new EmbedBuilder()
                .setColor(data.member ? 'Green' : 'Grey')
                .setTitle(data.member ? 'New Member' : 'New Guest')
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: 'Name', value: data.name },
                    { name: 'Discord @', value: `<@${user.id}>` },
                    { name: 'Email', value: data.email }
                );

            const row = new ActionRowBuilder();
            const approve = new ButtonBuilder()
                .setCustomId(data.member ? 'approveMember' : 'approveGuest')
                .setLabel(data.member ? 'Approve Member' : 'Approve Guest')
                .setStyle(data.member ? ButtonStyle.Success : ButtonStyle.Primary);

            const engageLink = new ButtonBuilder()
                .setLabel('Engage')
                .setStyle(ButtonStyle.Link)
                .setURL(
                    'https://wright.campuslabs.com/engage/actioncenter/organization/esports/roster/Roster/prospective'
                );

            row.addComponents(approve);

            if (data.member) row.addComponents(engageLink);

            logger.info('Sending embed');
            message.channel.send({
                content: '▬▬▬▬▬▬▬▬▬▬',
                embeds: [embed],
                components: [row]
            });

            logger.info('Sending reponse to sheet');
        }

        logger.info('Deleting webhook message');
        // finally delete the previous message
        message.delete();
        logger.section.END();
    } catch (err) {
        logger.error('Error occurred parsing data');
        logger.error(err);
        logger.section.END();
    }
}

// https://discord.com/api/webhooks/1276930937493524543/2Dzs19DL50rNlK_asRnzwgJiJwKHsW-EdYlEUTeewMn018wnxjE49SZVrPguRcsc8SKC

export default { addRestrictions, initiateApprovalEmbed };
