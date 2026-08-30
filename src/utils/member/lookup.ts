import type { Guild, GuildMember } from 'discord.js';

import Fuse, { type IFuseOptions as FuseOptions } from 'fuse.js';

export interface SimilarMemberMatch {
  member: GuildMember;
  score: number;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  bestMatchField: string;
}

export interface LookupContext {
  name?: string | null;
  email?: string | null;
}

export interface MemberSearchItem {
  member: GuildMember;
  id: string;
  username: string;
  cleanUsername: string;
  tag: string;
  displayName: string;
  globalName: string;
  nickname: string;
}

/**
 * Cleans a query string by removing leading @ and trailing discriminators (#0000 or #0).
 */
export function cleanUsernameQuery(query: string): string {
  return query
    .trim()
    .replace(/^@/, '')
    .replace(/#0+$/, '')
    .replace(/#\d{4}$/, '')
    .trim();
}

/**
 * Strips all non-alphanumeric characters for normalized comparison.
 */
export function normalizeAlphanumeric(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Converts a GuildMember into a searchable item for Fuse.js.
 */
export function toMemberSearchItem(member: GuildMember): MemberSearchItem {
  return {
    member,
    id: member.id,
    username: member.user.username.toLowerCase(),
    cleanUsername: normalizeAlphanumeric(member.user.username),
    tag: member.user.tag.toLowerCase(),
    displayName: member.displayName.toLowerCase(),
    globalName: (member.user.globalName ?? '').toLowerCase(),
    nickname: (member.nickname ?? '').toLowerCase(),
  };
}

const FUSE_OPTIONS: FuseOptions<MemberSearchItem> = {
  includeScore: true,
  threshold: 0.6,
  ignoreLocation: true,
  keys: [
    { name: 'username', weight: 0.35 },
    { name: 'cleanUsername', weight: 0.25 },
    { name: 'displayName', weight: 0.2 },
    { name: 'globalName', weight: 0.15 },
    { name: 'nickname', weight: 0.15 },
    { name: 'tag', weight: 0.15 },
    { name: 'id', weight: 0.4 },
  ],
};

/**
 * Evaluates how closely a GuildMember matches a query and context using Fuse.js.
 */
export function scoreMemberMatch(member: GuildMember, query: string, context?: LookupContext): SimilarMemberMatch {
  if (member.user.bot) {
    return { member, score: 0, confidence: 'low', bestMatchField: 'bot' };
  }

  const cleanQuery = cleanUsernameQuery(query);
  const lowerQuery = cleanQuery.toLowerCase();
  const normQuery = normalizeAlphanumeric(cleanQuery);

  const item = toMemberSearchItem(member);

  // 1. Direct ID match
  if (/^\d{17,20}$/.test(query.trim()) && member.id === query.trim()) {
    return { member, score: 1.0, confidence: 'exact', bestMatchField: 'user_id' };
  }

  // 2. Exact username / tag match
  if (item.username === lowerQuery || item.tag === lowerQuery) {
    return { member, score: 1.0, confidence: 'exact', bestMatchField: 'username' };
  }

  // 3. Exact display name / global name / nickname match
  if (item.displayName === lowerQuery || item.globalName === lowerQuery || item.nickname === lowerQuery) {
    return { member, score: 0.98, confidence: 'exact', bestMatchField: 'display_name' };
  }

  // 4. Normalized alphanumeric exact match
  if (normQuery.length > 1 && item.cleanUsername === normQuery) {
    return { member, score: 0.95, confidence: 'exact', bestMatchField: 'username_normalized' };
  }

  // 5. Fuse.js search on the single item
  const fuse = new Fuse([item], FUSE_OPTIONS);
  let bestScore = 0;
  let bestField = 'username_fuzzy';

  const queryResults = fuse.search(cleanQuery);
  if (queryResults.length > 0 && queryResults[0].score !== undefined) {
    const fuseScore = 1 - queryResults[0].score;
    if (fuseScore > bestScore) {
      bestScore = fuseScore;
      bestField = 'username_fuzzy';
    }
  }

  // 6. Cross-reference with context.name if present
  if (context?.name) {
    const nameResults = fuse.search(context.name.trim());
    if (nameResults.length > 0 && nameResults[0].score !== undefined) {
      const nameScore = (1 - nameResults[0].score) * 0.85;
      if (nameScore > bestScore) {
        bestScore = nameScore;
        bestField = 'form_name_match';
      }
    }
  }

  // 7. Cross-reference with context.email handle if present
  if (context?.email) {
    const emailHandle = context.email.split('@')[0]?.trim();
    if (emailHandle && emailHandle.length >= 3) {
      const emailResults = fuse.search(emailHandle);
      if (emailResults.length > 0 && emailResults[0].score !== undefined) {
        const emailScore = (1 - emailResults[0].score) * 0.8;
        if (emailScore > bestScore) {
          bestScore = emailScore;
          bestField = 'email_handle_match';
        }
      }
    }
  }

  const confidence = bestScore >= 0.95 ? 'exact' : bestScore >= 0.75 ? 'high' : bestScore >= 0.5 ? 'medium' : 'low';

  return { member, score: bestScore, confidence, bestMatchField: bestField };
}

/**
 * Looks up a member in a guild with strict high-confidence matching.
 * Returns the matched GuildMember or null if not found.
 */
export async function findGuildMember(
  guild: Guild,
  query?: string | null,
  context?: LookupContext,
): Promise<GuildMember | null> {
  if (!query) return null;

  try {
    const cleanQuery = cleanUsernameQuery(query);
    if (!cleanQuery) return null;

    // Check if query is a direct user ID
    if (/^\d{17,20}$/.test(cleanQuery)) {
      const byId = await guild.members.fetch(cleanQuery).catch(() => null);
      if (byId && !byId.user.bot) return byId;
    }

    // Try fetching matches from Discord API
    const matches = await guild.members.fetch({ query: cleanQuery, limit: 5 }).catch(() => null);

    if (matches && matches.size > 0) {
      const scored = matches
        .map((m) => scoreMemberMatch(m, cleanQuery, context))
        .filter((m) => !m.member.user.bot)
        .sort((a, b) => b.score - a.score);

      if (scored[0] && scored[0].score >= 0.95) {
        return scored[0].member;
      }
    }

    // Check cached members for exact match
    const cachedExact = guild.members.cache.find(
      (m) =>
        !m.user.bot &&
        (m.user.username.toLowerCase() === cleanQuery.toLowerCase() ||
          m.user.tag.toLowerCase() === cleanQuery.toLowerCase() ||
          m.displayName.toLowerCase() === cleanQuery.toLowerCase()),
    );

    return cachedExact ?? null;
  } catch {
    return null;
  }
}

/**
 * Finds up to `limit` candidates in the guild most similar to the query and context using Fuse.js.
 */
export async function findSimilarGuildMembers(
  guild: Guild,
  query?: string | null,
  limit: number = 5,
  context?: LookupContext,
): Promise<SimilarMemberMatch[]> {
  if (!query && !context?.name && !context?.email) {
    return [];
  }

  const cleanQuery = query ? cleanUsernameQuery(query) : '';
  const candidateMap = new Map<string, GuildMember>();

  // Add all cached members
  for (const [id, member] of guild.members.cache) {
    if (!member.user.bot) {
      candidateMap.set(id, member);
    }
  }

  // Fetch candidates from Discord API with multiple search variations
  const searchTerms = new Set<string>();
  if (cleanQuery && cleanQuery.length >= 2) {
    searchTerms.add(cleanQuery);
    const norm = normalizeAlphanumeric(cleanQuery);
    if (norm && norm !== cleanQuery.toLowerCase()) {
      searchTerms.add(norm);
    }
  }

  if (context?.name) {
    const parts = context.name.trim().split(/\s+/);
    for (const part of parts) {
      if (part.length >= 3) searchTerms.add(part);
    }
  }

  if (context?.email) {
    const emailHandle = context.email.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, '');
    if (emailHandle && emailHandle.length >= 3) {
      searchTerms.add(emailHandle);
    }
  }

  for (const term of searchTerms) {
    try {
      const fetched = await guild.members.fetch({ query: term, limit: 10 });
      for (const [id, member] of fetched) {
        if (!member.user.bot) {
          candidateMap.set(id, member);
        }
      }
    } catch {
      // Continue to next search term
    }
  }

  const candidateItems = Array.from(candidateMap.values()).map(toMemberSearchItem);
  if (candidateItems.length === 0) {
    return [];
  }

  const fuse = new Fuse(candidateItems, FUSE_OPTIONS);
  const scoreMap = new Map<string, SimilarMemberMatch>();

  // Helper to record match
  const recordMatch = (member: GuildMember, score: number, field: string) => {
    const existing = scoreMap.get(member.id);
    if (!existing || score > existing.score) {
      const confidence = score >= 0.95 ? 'exact' : score >= 0.75 ? 'high' : score >= 0.5 ? 'medium' : 'low';
      scoreMap.set(member.id, { member, score, confidence, bestMatchField: field });
    }
  };

  // 1. Direct Fuse search on query
  if (cleanQuery) {
    const results = fuse.search(cleanQuery);
    for (const result of results) {
      const score = Math.max(0, 1 - (result.score ?? 1));
      recordMatch(result.item.member, score, 'fuse_username_search');
    }
  }

  // 2. Direct Fuse search on name context
  if (context?.name) {
    const results = fuse.search(context.name.trim());
    for (const result of results) {
      const score = Math.max(0, (1 - (result.score ?? 1)) * 0.85);
      recordMatch(result.item.member, score, 'fuse_name_search');
    }
  }

  // 3. Direct Fuse search on email context
  if (context?.email) {
    const emailHandle = context.email.split('@')[0]?.trim();
    if (emailHandle && emailHandle.length >= 3) {
      const results = fuse.search(emailHandle);
      for (const result of results) {
        const score = Math.max(0, (1 - (result.score ?? 1)) * 0.8);
        recordMatch(result.item.member, score, 'fuse_email_search');
      }
    }
  }

  // 4. Also check explicit exact matches for all candidates
  for (const item of candidateItems) {
    const match = scoreMemberMatch(item.member, cleanQuery, context);
    if (match.score > 0.15) {
      recordMatch(item.member, match.score, match.bestMatchField);
    }
  }

  const sorted = Array.from(scoreMap.values())
    .filter((m) => m.score > 0.15)
    .sort((a, b) => b.score - a.score);

  return sorted.slice(0, limit);
}
