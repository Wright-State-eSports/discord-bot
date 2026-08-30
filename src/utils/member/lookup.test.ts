import type { GuildMember } from 'discord.js';

import { describe, expect, it } from 'bun:test';

import { cleanUsernameQuery, normalizeAlphanumeric, scoreMemberMatch } from './lookup';

describe('Member Lookup & Similarity (Fuse.js)', () => {
  describe('cleanUsernameQuery', () => {
    it('removes leading @', () => {
      expect(cleanUsernameQuery('@joshq')).toBe('joshq');
    });

    it('removes legacy discriminators', () => {
      expect(cleanUsernameQuery('joshq#1234')).toBe('joshq');
      expect(cleanUsernameQuery('joshq#0000')).toBe('joshq');
      expect(cleanUsernameQuery('joshq#0')).toBe('joshq');
    });

    it('trims whitespace', () => {
      expect(cleanUsernameQuery('  @joshq  ')).toBe('joshq');
    });
  });

  describe('normalizeAlphanumeric', () => {
    it('removes special characters and lowercases', () => {
      expect(normalizeAlphanumeric('Josh_Q.123')).toBe('joshq123');
    });
  });

  describe('scoreMemberMatch', () => {
    const mockMember = (data: {
      id: string;
      username: string;
      tag?: string;
      displayName?: string;
      globalName?: string;
      nickname?: string;
      bot?: boolean;
    }) =>
      ({
        id: data.id,
        user: {
          id: data.id,
          username: data.username,
          tag: data.tag ?? data.username,
          globalName: data.globalName ?? data.displayName ?? data.username,
          bot: Boolean(data.bot),
        },
        displayName: data.displayName ?? data.username,
        nickname: data.nickname ?? null,
      }) as unknown as GuildMember;

    it('returns 0 score for bot accounts', () => {
      const bot = mockMember({ id: '1', username: 'helperbot', bot: true });
      const result = scoreMemberMatch(bot, 'helperbot');
      expect(result.score).toBe(0);
    });

    it('returns 1.0 for exact username match', () => {
      const member = mockMember({ id: '123456789012345678', username: 'joshq' });
      const result = scoreMemberMatch(member, '@joshq');
      expect(result.score).toBe(1.0);
      expect(result.confidence).toBe('exact');
    });

    it('returns high score for normalized username match', () => {
      const member = mockMember({ id: '123456789012345678', username: 'joshq' });
      const result = scoreMemberMatch(member, 'josh_q');
      expect(result.score).toBeGreaterThanOrEqual(0.8);
    });

    it('matches when real name is provided in context', () => {
      const member = mockMember({
        id: '123456789012345678',
        username: 'jq99',
        displayName: 'Joshua Quaintance',
      });
      const result = scoreMemberMatch(member, 'unknown_user', {
        name: 'Joshua Quaintance',
      });
      expect(result.score).toBeGreaterThanOrEqual(0.5);
    });

    it('matches when email handle is provided in context', () => {
      const member = mockMember({
        id: '123456789012345678',
        username: 'quaintance5',
      });
      const result = scoreMemberMatch(member, 'unknown_user', {
        email: 'quaintance5@wright.edu',
      });
      expect(result.score).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('isMessageAlreadyEnriched', () => {
    it('returns false for messages without components', async () => {
      const { isMessageAlreadyEnriched } = await import('../registration/card');
      expect(isMessageAlreadyEnriched(undefined)).toBe(false);
      expect(isMessageAlreadyEnriched({ components: [] } as unknown as any)).toBe(false);
    });

    it('returns true when registration buttons are present', async () => {
      const { isMessageAlreadyEnriched } = await import('../registration/card');
      const messageWithButtons = {
        components: [
          {
            components: [{ customId: 'approve-member' }],
          },
        ],
      } as unknown as any;

      expect(isMessageAlreadyEnriched(messageWithButtons)).toBe(true);
    });

    it('returns true when select menus are present', async () => {
      const { isMessageAlreadyEnriched } = await import('../registration/card');
      const messageWithMenu = {
        components: [
          {
            components: [{ customId: 'select-registration-user' }],
          },
        ],
      } as unknown as any;

      expect(isMessageAlreadyEnriched(messageWithMenu)).toBe(true);
    });
  });
});
