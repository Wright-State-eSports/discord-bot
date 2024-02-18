import { GuildMember } from 'discord.js';

import newMemberData from './data/new-member.json';

/**
 * Applies restrictions from not being signed up:
 * - Deny View Channel permission on role-tied channels
 *
 * @param { GuildMember } member
 */
async function addRestrictions(member) {
    const categories = member.guild.channels.cache.filter(
        (val) => val.type === 4 && newMemberData['deny-categories'].includes(val.id)
    );

    // Apply the DENY View Channel permission to all the categories
    for (const category of categories) {
        await category.permissionOverwrites.edit(member.id, { ViewChannel: false }, { type: 1 });
    }
}

/**
 * Removes the applied restrictions from not being signed up:
 * - Deny View Channel permission on role-tied channels
 *
 * @param { GuildMember } member
 */
async function removeRestrictions(member) {
    if (member.roles.has(newMemberData['roles']['not-signed-up'])) {
        const categories = member.guild.channels.cache.filter(
            (val) => val.type === 4 && newMemberData['deny-categories'].includes(val.id)
        );

        // Removes all the permission overwrides that the user had on
        // the categories (which most likely are deny view channels)
        for (const category of categories) {
            await category.permissionOverwrites.delete(member.id);
        }
    }
}

export default { addRestrictions, removeRestrictions };
