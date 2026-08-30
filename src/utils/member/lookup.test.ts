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

  describe('isRegistrationEmbed', () => {
    it('returns true for valid new registration embeds', async () => {
      const { isRegistrationEmbed } = await import('../registration/card');

      const validEmbed = {
        title: 'New Member',
        fields: [
          { name: 'Name', value: 'Jane Doe' },
          { name: 'Discord Username', value: 'janedoe' },
          { name: 'Email', value: 'jane@example.com' },
        ],
      } as unknown as any;

      expect(isRegistrationEmbed(validEmbed)).toBe(true);
    });

    it('returns false for non-registration embeds (e.g., bot logs, announcements)', async () => {
      const { isRegistrationEmbed } = await import('../registration/card');

      const logEmbed = {
        title: 'Bot Logs',
        fields: [{ name: 'Event', value: 'User Joined' }],
      } as unknown as any;

      expect(isRegistrationEmbed(logEmbed)).toBe(false);

      const generalEmbed = {
        title: 'Server Announcement',
        description: 'Welcome to the tournament!',
      } as unknown as any;

      expect(isRegistrationEmbed(generalEmbed)).toBe(false);
      expect(isRegistrationEmbed(undefined)).toBe(false);
    });
  });

  describe('extractRegistrationDataFromCard', () => {
    it('correctly detects guest registration from title or field', async () => {
      const { extractRegistrationDataFromCard } = await import('../registration/card');

      const guestCardWithField = {
        embeds: [
          {
            title: 'New Registration',
            fields: [
              { name: 'Name', value: 'Jane Doe' },
              { name: 'Discord Username', value: 'janedoe' },
              { name: 'Register As', value: 'Guest' },
              { name: 'Email', value: 'jane@example.com' },
            ],
          },
        ],
      } as unknown as any;

      const guestResult = extractRegistrationDataFromCard(guestCardWithField);
      expect(guestResult?.registerAs).toBe('guest');
      expect(guestResult?.name).toBe('Jane Doe');

      const guestCardWithTitle = {
        embeds: [
          {
            title: 'New Guest',
            fields: [
              { name: 'Full Name', value: 'Jane Doe' },
              { name: 'Discord @', value: '<@123456789>' },
              { name: 'Discord Username', value: 'janedoe' },
            ],
          },
        ],
      } as unknown as any;

      const titleResult = extractRegistrationDataFromCard(guestCardWithTitle);
      expect(titleResult?.registerAs).toBe('guest');

      const guestCardWithAffiliation = {
        embeds: [
          {
            title: 'Registration Form Submission',
            fields: [
              { name: 'Full Name', value: 'Jane Doe' },
              { name: 'Discord Tag', value: 'janedoe' },
              { name: 'Affiliation', value: 'Guest' },
            ],
          },
        ],
      } as unknown as any;

      const affiliationResult = extractRegistrationDataFromCard(guestCardWithAffiliation);
      expect(affiliationResult?.registerAs).toBe('guest');

      const guestCardWithFormName = {
        embeds: [
          {
            title: 'New Signup',
            fields: [
              { name: 'Full Name', value: 'Jane Doe' },
              { name: 'Discord Username', value: 'janedoe' },
              { name: 'Form Type', value: 'Guest Sign up' },
            ],
          },
        ],
      } as unknown as any;

      const formNameResult = extractRegistrationDataFromCard(guestCardWithFormName);
      expect(formNameResult?.registerAs).toBe('guest');
    });

    it('correctly detects member registration', async () => {
      const { extractRegistrationDataFromCard } = await import('../registration/card');

      const memberCard = {
        embeds: [
          {
            title: 'New Member',
            fields: [
              { name: 'Name', value: 'John Smith' },
              { name: 'Discord Username', value: 'johnsmith' },
              { name: 'Email', value: 'johnsmith@wright.edu' },
            ],
          },
        ],
      } as unknown as any;

      const result = extractRegistrationDataFromCard(memberCard);
      expect(result?.registerAs).toBe('member');
      expect(result?.name).toBe('John Smith');
    });
  });

  describe('buildMatchedRegistrationEmbed', () => {
    it('creates standard member embed when member does not have guest role', async () => {
      const { buildMatchedRegistrationEmbed } = await import('../registration/card');

      const mockMember = {
        id: '123456789',
        user: { username: 'johnsmith', tag: 'johnsmith#0000' },
        displayAvatarURL: () => 'https://example.com/avatar.png',
        roles: { cache: new Map() },
      } as unknown as any;

      const embed = await buildMatchedRegistrationEmbed(
        {
          name: 'John Smith',
          discordUsername: 'johnsmith',
          email: 'john@wright.edu',
          registerAs: 'member',
          sheetRow: '5',
        },
        mockMember,
      );

      expect(embed.data.title).toBe('New Member');
      expect(embed.data.fields?.some((f) => f.name === 'Register As' && f.value === 'Member')).toBe(true);
    });

    it('creates guest upgrade embed with notices when member has guest role', async () => {
      const { buildMatchedRegistrationEmbed } = await import('../registration/card');
      const { Config, ConfigKeys } = await import('../config');

      const guestRoleId = (await Config.get(ConfigKeys.Roles.Guest)) || 'guest-role-id';

      const mockRoles = new Map();
      mockRoles.set(guestRoleId, { id: guestRoleId });

      const mockMember = {
        id: '123456789',
        user: { username: 'janedoe', tag: 'janedoe#0000' },
        displayAvatarURL: () => 'https://example.com/avatar.png',
        roles: { cache: mockRoles },
      } as unknown as any;

      const embed = await buildMatchedRegistrationEmbed(
        {
          name: 'Jane Doe',
          discordUsername: 'janedoe',
          email: 'jane@wright.edu',
          registerAs: 'member',
          sheetRow: '8',
        },
        mockMember,
      );

      expect(embed.data.title).toBe('New Member (Guest Upgrade)');
      expect(embed.data.fields?.some((f) => f.name === 'ℹ️ Guest Upgrade')).toBe(true);
      expect(embed.data.fields?.some((f) => f.name === 'Register As' && f.value.includes('Upgrading from Guest'))).toBe(
        true,
      );
    });
  });
});
