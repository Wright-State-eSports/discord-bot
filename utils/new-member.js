import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

import Fuse from 'fuse.js';

import logger from '../utils/loggers/logger.js';
import roleIds from '../data/role-ids.json' with { type: 'json' };

/**
 * Applies restrictions from not being signed up
 *
 * @param { GuildMember } member
 */
export async function addRestrictions(member) {
    member.roles.add(roleIds['not-signed-up']);
}

/**
 *
 * @param { import('discord.js').Message } message
 * @returns
 */
export async function initiateApprovalEmbed(message) {
    if (message.channelId !== '1280328507905282068' || message.webhookId !== '1280328619704451114')
        return;

    if (message.guildId !== '484520129267499042') return;

    logger.section.START();
    logger.info('Webhook data received... Parsing data');

    try {
        const data = JSON.parse(message.content);

        let possibleMatches = await message.guild.members.fetch({ query: data.username, limit: 5 });
        let userAlreadyApproved = false;

        logger.info('Parse successful!');

        // User isn't in discord
        if (possibleMatches.size === 0) {
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
            await message.channel.send({
                content: '▬▬▬▬▬▬▬▬▬▬',
                embeds: [embed]
            });

            // If user does exist in discord
        } else {
            logger.info('User found!');
            /**
             * @type { import('discord.js').GuildMember }
             */
            const user = possibleMatches.first();

            const embed = new EmbedBuilder();

            userAlreadyApproved =
                user.roles.cache.has(roleIds['raider']) || user.roles.cache.has(roleIds['guest']);

            if (userAlreadyApproved) {
                embed
                    .setColor('Green')
                    .setTitle('User is already a member')
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: 'Name', value: data.name },
                        { name: 'Discord @', value: `<@${user.id}>` },
                        { name: 'Discord Username', value: data.username },
                        { name: 'Email', value: data.email },
                        { name: 'Sheet Row', value: `${data.rowNum}` }
                    );
            } else if (data.member)
                embed
                    .setColor('Green')
                    .setTitle('New Member')
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: 'Name', value: data.name },
                        { name: 'Discord @', value: `<@${user.id}>` },
                        { name: 'Discord Username', value: data.username },
                        { name: 'Email', value: data.email },
                        { name: 'Sheet Row', value: `${data.rowNum}` }
                    );
            else
                embed
                    .setColor('Grey')
                    .setTitle('New Guest')
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: 'Name', value: data.name },
                        { name: 'Discord @', value: `<@${user.id}>` },
                        { name: 'Discord Username', value: data.username },
                        { name: 'Email', value: data.email },
                        { name: 'Purpose of joining', value: data.purpose }
                    );

            const row = new ActionRowBuilder();
            const approve = new ButtonBuilder()
                .setCustomId(data.member ? 'approveMember' : 'approveGuest')
                .setLabel(data.member ? 'Approve Member' : 'Approve Guest')
                .setStyle(data.member ? ButtonStyle.Success : ButtonStyle.Secondary);

            const engageLink = new ButtonBuilder()
                .setLabel('Engage')
                .setStyle(ButtonStyle.Link)
                .setURL(
                    'https://wright.campuslabs.com/engage/actioncenter/organization/esports/roster/Roster/prospective'
                );

            // Configure payload
            let payload = {
                content: '▬▬▬▬▬▬▬▬▬▬',
                embeds: [embed]
            };

            if (!userAlreadyApproved) {
                row.addComponents(approve);

                if (data.member) row.addComponents(engageLink);
                payload.components = [row];
            }

            logger.info('Sending embed');
            await message.channel.send(payload);

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
