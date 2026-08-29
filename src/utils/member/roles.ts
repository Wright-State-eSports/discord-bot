import type { GuildMember } from 'discord.js';

import { Config, ConfigKeys } from '../config';

/**
 * Retrieves configured role IDs for registration roles.
 * Throws an error if any role ID is not configured in the bot settings.
 */
export async function getRegistrationRoleIds(): Promise<{
  raider: string;
  guest: string;
  notSignedUp: string;
}> {
  const [raider, guest, notSignedUp] = await Promise.all([
    Config.get(ConfigKeys.Roles.Raider),
    Config.get(ConfigKeys.Roles.Guest),
    Config.get(ConfigKeys.Roles.NotSignedUp),
  ]);

  if (!raider || !guest || !notSignedUp) {
    throw new Error(
      `Missing required role config: raider=${raider || 'missing'}, guest=${guest || 'missing'}, not-signed-up=${notSignedUp || 'missing'}`,
    );
  }

  return { raider, guest, notSignedUp };
}

/**
 * Checks if a member has the Raider (full member) role.
 */
export async function hasRaiderRole(member: GuildMember): Promise<boolean> {
  const roleId = await Config.get(ConfigKeys.Roles.Raider);
  if (!roleId) return false;
  return member.roles.cache.has(roleId);
}

/**
 * Checks if a member has the Guest role.
 */
export async function hasGuestRole(member: GuildMember): Promise<boolean> {
  const roleId = await Config.get(ConfigKeys.Roles.Guest);
  if (!roleId) return false;
  return member.roles.cache.has(roleId);
}

/**
 * Checks if a member has the Not-Signed-Up role.
 */
export async function hasNotSignedUpRole(member: GuildMember): Promise<boolean> {
  const roleId = await Config.get(ConfigKeys.Roles.NotSignedUp);
  if (!roleId) return false;
  return member.roles.cache.has(roleId);
}

/**
 * Determines whether a member is considered already approved for a given registration type:
 * - For 'member': user already has the Raider role (Guest is allowed to upgrade to Member).
 * - For 'guest': user already has either the Guest role or the Raider role.
 */
export async function isRegistrationAlreadyApproved(member: GuildMember, registerAs: string): Promise<boolean> {
  const { raider, guest } = await getRegistrationRoleIds();
  const isMember = registerAs.toLowerCase() === 'member';

  if (isMember) {
    return member.roles.cache.has(raider);
  }

  return member.roles.cache.has(raider) || member.roles.cache.has(guest);
}

/**
 * Assigns the Raider role and removes Not-Signed-Up and Guest roles.
 */
export async function promoteToRaider(member: GuildMember): Promise<void> {
  const { raider, guest, notSignedUp } = await getRegistrationRoleIds();

  await member.roles.add(raider);
  await member.roles.remove(notSignedUp).catch(() => {});
  await member.roles.remove(guest).catch(() => {});
}

/**
 * Assigns the Guest role and removes the Not-Signed-Up role.
 */
export async function promoteToGuest(member: GuildMember): Promise<void> {
  const { guest, notSignedUp } = await getRegistrationRoleIds();

  await member.roles.add(guest);
  await member.roles.remove(notSignedUp).catch(() => {});
}

/**
 * Reverts a Raider approval by removing Raider and re-adding Not-Signed-Up.
 */
export async function revertRaider(member: GuildMember): Promise<void> {
  const { raider, notSignedUp } = await getRegistrationRoleIds();

  await member.roles.remove(raider).catch(() => {});
  await member.roles.add(notSignedUp).catch(() => {});
}

/**
 * Reverts a Guest approval by removing Guest and re-adding Not-Signed-Up.
 */
export async function revertGuest(member: GuildMember): Promise<void> {
  const { guest, notSignedUp } = await getRegistrationRoleIds();

  await member.roles.remove(guest).catch(() => {});
  await member.roles.add(notSignedUp).catch(() => {});
}
