import { GuildMember } from 'discord.js';

import newMemberData from '../data/new-member.json' assert { type: 'json' };

/**
 * Applies restrictions from not being signed up
 *
 * @param { GuildMember } member
 */
async function addRestrictions(member) {
    member.roles.add(newMemberData['roles']['not-signed-up']);
}

// https://discord.com/api/webhooks/1276930937493524543/2Dzs19DL50rNlK_asRnzwgJiJwKHsW-EdYlEUTeewMn018wnxjE49SZVrPguRcsc8SKC

export default { addRestrictions };
