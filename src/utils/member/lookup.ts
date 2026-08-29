import type { Guild, GuildMember } from 'discord.js';

/**
 * Looks up a member in a guild by username, Discord tag, or display name.
 * @param guild The guild to search within
 * @param query The username or mention query
 * @returns The matched GuildMember or null if not found
 */
export async function findGuildMember(guild: Guild, query?: string | null): Promise<GuildMember | null> {
  if (!query) return null;

  try {
    const cleanQuery = query.replace(/^@/, '').trim();
    if (!cleanQuery) return null;

    const matches = await guild.members.fetch({ query: cleanQuery, limit: 5 });

    return (
      matches.find(
        (m) =>
          m.user.username.toLowerCase() === cleanQuery.toLowerCase() ||
          m.user.tag.toLowerCase() === cleanQuery.toLowerCase() ||
          m.displayName.toLowerCase() === cleanQuery.toLowerCase(),
      ) ??
      matches.first() ??
      null
    );
  } catch {
    return null;
  }
}
