/**
 * Main utility file, any general purpose utility functions that don't need
 * a dedicated module file should be placed here.
 */
import type { Channel, GuildChannel, GuildMember, Interaction, ThreadChannel, User } from 'discord.js';

export type UserLike =
  | Interaction
  | User
  | GuildMember
  | { user?: { tag?: string; username?: string; id?: string }; tag?: string; username?: string; id?: string }
  | string
  | null
  | undefined;

export type ChannelLike =
  | Channel
  | GuildChannel
  | ThreadChannel
  | { id: string; name?: string }
  | string
  | null
  | undefined;

/**
 * Formats a user as readable username/tag + mention string:
 * `username (<@123456789012345678>)` or `<@123456789012345678>`
 */
export function userCombo(target: UserLike, fallbackId?: string): string {
  if (!target) return fallbackId ? `<@${fallbackId}>` : 'Unknown User';

  if (typeof target === 'string') {
    return /^\d{17,19}$/.test(target) ? `<@${target}>` : target;
  }

  // Handle Interaction or GuildMember where user property exists
  if (typeof target === 'object' && 'user' in target && target.user) {
    const u = target.user;
    const name = u.tag && u.tag !== '0' ? u.tag : u.username;
    return name ? `${name} (<@${u.id}>)` : `<@${u.id}>`;
  }

  // Handle User or object with tag/username
  if (typeof target === 'object') {
    const id = target.id ?? fallbackId;
    const tag =
      'tag' in target && typeof target.tag === 'string' && target.tag !== '0'
        ? target.tag
        : 'username' in target && typeof target.username === 'string'
          ? target.username
          : undefined;

    if (tag && id) {
      return `${tag} (<@${id}>)`;
    }
    if (id) {
      return `<@${id}>`;
    }
    return tag ?? 'Unknown User';
  }

  return 'Unknown User';
}

/**
 * Formats a channel as readable name + channel mention:
 * `#channel-name (<#123456789012345678>)` or `<#123456789012345678>`
 */
export function channelCombo(channel: ChannelLike, fallbackId?: string): string {
  if (!channel) return fallbackId ? `<#${fallbackId}>` : 'Unknown Channel';

  if (typeof channel === 'string') {
    return /^\d{17,19}$/.test(channel) ? `<#${channel}>` : channel;
  }

  const id = channel.id ?? fallbackId;
  const name = 'name' in channel && typeof channel.name === 'string' ? channel.name : undefined;

  if (name && id) {
    return `#${name} (<#${id}>)`;
  }
  if (id) {
    return `<#${id}>`;
  }
  return name ? `#${name}` : 'Unknown Channel';
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
