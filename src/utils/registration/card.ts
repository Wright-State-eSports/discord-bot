import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  type ButtonInteraction,
  type Embed,
  type GuildMember,
  type Message,
} from 'discord.js';

import {
  findGuildMember,
  findSimilarGuildMembers,
  hasGuestRole,
  isRegistrationAlreadyApproved,
  type SimilarMemberMatch,
} from '../member';

export interface RegistrationData {
  name: string;
  discordUsername: string;
  email: string;
  registerAs: 'member' | 'guest';
  sheetRow: string;
  purpose?: string;
  discovery?: string;
}

/**
 * Extracts a Discord user ID from the registration card embed's 'Discord @' field or other mention format.
 */
export function extractUserIdFromCard(source: ButtonInteraction | Message | Embed | undefined): string | null {
  if (!source) return null;

  let embed: Embed | undefined;
  if ('message' in source && source.message) {
    embed = source.message.embeds[0];
  } else if ('embeds' in source) {
    embed = source.embeds[0];
  } else if ('fields' in source) {
    embed = source as Embed;
  }

  if (!embed) return null;

  const mentionField = embed.fields?.find((f) => f.name === 'Discord @');
  if (mentionField) {
    const match = mentionField.value.match(/<@!?(\d+)>/);
    if (match) return match[1];
  }

  // Fallback: check any field with mention
  if (embed.fields) {
    for (const field of embed.fields) {
      const match = field.value.match(/<@!?(\d+)>/);
      if (match) return match[1];
    }
  }

  // Fallback: check description
  if (embed.description) {
    const match = embed.description.match(/<@!?(\d+)>/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extracts registration form data from an existing registration card embed or message.
 */
export function extractRegistrationDataFromCard(
  source: ButtonInteraction | Message | Embed | undefined,
): RegistrationData | null {
  if (!source) return null;

  let embed: Embed | undefined;
  if ('message' in source && source.message) {
    embed = source.message.embeds[0];
  } else if ('embeds' in source) {
    embed = source.embeds[0];
  } else if ('fields' in source) {
    embed = source as Embed;
  }

  if (!embed || !embed.fields) return null;

  const normalizedFields = new Map<string, string>();
  for (const f of embed.fields) {
    const key = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    normalizedFields.set(key, f.value.trim());
  }

  const getField = (...candidates: string[]): string | undefined => {
    for (const c of candidates) {
      const normalized = c.toLowerCase().replace(/[^a-z0-9]/g, '');
      const val = normalizedFields.get(normalized);
      if (val) return val;
    }
    return undefined;
  };

  const name = getField('name', 'fullname', 'realname', 'registrantname') || 'Unknown';
  const discordUsername =
    getField('submittedusername', 'discordusername', 'username', 'discordtag', 'discord', 'tag') || '';
  const email = getField('email', 'wsuemail', 'emailaddress') || '';
  const sheetRow = getField('sheetrow', 'row') || '';
  const purpose = getField('purposeofjoining', 'purpose', 'reason');
  const discovery = getField('discovery', 'howdidyouhear');

  // Check title, description, footer, author for guest designation
  const titleLower = embed.title?.toLowerCase() || '';
  const descLower = embed.description?.toLowerCase() || '';
  const footerLower = embed.footer?.text?.toLowerCase() || '';
  const authorLower = embed.author?.name?.toLowerCase() || '';
  const textHasGuest =
    titleLower.includes('guest') ||
    descLower.includes('guest') ||
    footerLower.includes('guest') ||
    authorLower.includes('guest');

  const rawRegisterAs = getField(
    'registeras',
    'registrationtype',
    'registeringas',
    'form',
    'formname',
    'formtitle',
    'formtype',
    'signuptype',
    'membershiptype',
    'membership',
    'membertype',
    'type',
    'role',
    'status',
    'usertype',
    'affiliation',
    'accounttype',
    'classification',
    'studentorguest',
    'wsuaffiliate',
  );
  const fieldHasGuest = rawRegisterAs?.toLowerCase().includes('guest');

  let anyFieldHasGuest = false;
  for (const [key, val] of normalizedFields.entries()) {
    const valLower = val.toLowerCase();
    if (
      key.includes('guest') &&
      (valLower === 'yes' || valLower === 'true' || valLower === '1' || valLower === 'guest')
    ) {
      anyFieldHasGuest = true;
      break;
    }
    if (
      valLower === 'guest' ||
      valLower.startsWith('guest ') ||
      valLower.includes('guest signup') ||
      valLower.includes('guest registration')
    ) {
      anyFieldHasGuest = true;
      break;
    }
  }

  const isGuest = Boolean(textHasGuest || fieldHasGuest || anyFieldHasGuest);

  return {
    name,
    discordUsername,
    email,
    registerAs: isGuest ? 'guest' : 'member',
    sheetRow,
    purpose,
    discovery,
  };
}

export interface CardMetadata {
  notification?: { channelId: string; messageId: string } | null;
  reminder?: { helpChannelId: string; threadId: string } | null;
}

/**
 * Extracts all tracked metadata from the card message content subtext (-#) or embed footer.
 */
export function extractCardMetadata(source: ButtonInteraction | Message | undefined): CardMetadata {
  if (!source) return {};

  const message = 'message' in source ? source.message : source;
  const content = message.content || '';

  let notification: { channelId: string; messageId: string } | null = null;
  let reminder: { helpChannelId: string; threadId: string } | null = null;

  const notifMatch = content.match(/Notification:\s*(\d+)\/(\d+)/);
  if (notifMatch) {
    notification = { channelId: notifMatch[1], messageId: notifMatch[2] };
  } else {
    const embed = message.embeds[0];
    const footerMatch = embed?.footer?.text?.match(/Notification:\s*(\d+)\/(\d+)/);
    if (footerMatch) {
      notification = { channelId: footerMatch[1], messageId: footerMatch[2] };
    }
  }

  const reminderMatch = content.match(/Reminder:\s*(\d+)\/(\d+)/);
  if (reminderMatch) {
    reminder = { helpChannelId: reminderMatch[1], threadId: reminderMatch[2] };
  }

  return { notification, reminder };
}

/**
 * Extracts the approval notification channel ID and message ID from the message content (-# subtext) or embed footer.
 */
export function extractNotificationIds(
  source: ButtonInteraction | Message | undefined,
): { channelId: string; messageId: string } | null {
  return extractCardMetadata(source).notification ?? null;
}

/**
 * Extracts the reminder thread help channel ID and thread ID from the message content (-# subtext).
 */
export function extractReminderThreadId(
  source: ButtonInteraction | Message | undefined,
): { helpChannelId: string; threadId: string } | null {
  return extractCardMetadata(source).reminder ?? null;
}

/**
 * Formats notification metadata as tiny subtext (-#) for message content.
 */
export function formatNotificationSubtext(channelId: string, messageId: string): string {
  return `\n-# Notification: ${channelId}/${messageId}`;
}

/**
 * Formats reminder thread metadata as tiny subtext (-#) for message content.
 */
export function formatReminderSubtext(helpChannelId: string, threadId: string): string {
  return `\n-# Reminder: ${helpChannelId}/${threadId}`;
}

/**
 * Rebuilds the card message content with updated metadata, preserving existing dividers and metadata.
 */
export function formatCardContent(
  currentSource: ButtonInteraction | Message | string | undefined,
  updates: {
    notification?: { channelId: string; messageId: string } | null;
    reminder?: { helpChannelId: string; threadId: string } | null;
  } = {},
): string {
  const sourceObj =
    typeof currentSource === 'string' ? ({ content: currentSource, embeds: [] } as unknown as Message) : currentSource;

  const currentMeta = extractCardMetadata(sourceObj);

  const finalNotif = updates.notification !== undefined ? updates.notification : currentMeta.notification;
  const finalReminder = updates.reminder !== undefined ? updates.reminder : currentMeta.reminder;

  let text = '▬▬▬▬▬▬▬▬▬▬';
  if (finalNotif) {
    text += `\n-# Notification: ${finalNotif.channelId}/${finalNotif.messageId}`;
  }
  if (finalReminder) {
    text += `\n-# Reminder: ${finalReminder.helpChannelId}/${finalReminder.threadId}`;
  }

  return text;
}

/**
 * Builds the embed for a matched registration card.
 */
export async function buildMatchedRegistrationEmbed(
  data: RegistrationData,
  member: GuildMember,
): Promise<EmbedBuilder> {
  const isMember = data.registerAs === 'member';
  const isGuestUpgrading = isMember && (await hasGuestRole(member));

  const embed = new EmbedBuilder()
    .setColor(isMember ? Colors.Green : Colors.Grey)
    .setTitle(isMember ? (isGuestUpgrading ? 'New Member (Guest Upgrade)' : 'New Member') : 'New Guest')
    .setThumbnail(member.displayAvatarURL())
    .addFields(
      { name: 'Name', value: data.name },
      { name: 'Discord @', value: `<@${member.id}>` },
      { name: 'Discord Username', value: member.user.username || member.user.tag },
    );

  if (
    data.discordUsername &&
    data.discordUsername.toLowerCase() !== member.user.username.toLowerCase() &&
    data.discordUsername.toLowerCase() !== member.user.tag.toLowerCase()
  ) {
    embed.addFields({ name: 'Submitted Username', value: data.discordUsername });
  }

  const registerAsDisplay = isMember ? (isGuestUpgrading ? 'Member 🔄 *(Upgrading from Guest)*' : 'Member') : 'Guest';

  embed.addFields(
    { name: 'Register As', value: registerAsDisplay },
    { name: 'Email', value: data.email || 'N/A' },
    { name: 'Sheet Row', value: data.sheetRow || 'N/A' },
  );

  if (isGuestUpgrading) {
    embed.addFields({
      name: 'ℹ️ Guest Upgrade',
      value: 'User currently has the **Guest** role. Approving will assign **Raider** and remove **Guest**.',
    });
  }

  if (data.purpose) embed.addFields({ name: 'Purpose of joining', value: data.purpose });
  if (data.discovery) embed.addFields({ name: 'Discovery', value: data.discovery });

  return embed;
}

/**
 * Builds the action buttons for a matched registration card.
 */
export function buildMatchedActionRows(
  isMember: boolean,
  userAlreadyApproved: boolean,
  allowChangeUser: boolean = true,
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const remindBtn = new ButtonBuilder()
    .setCustomId('remind-signup')
    .setLabel('Remind')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🔔');

  const changeUserBtn = new ButtonBuilder()
    .setCustomId('change-registration-user')
    .setLabel('Change User')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🔄');

  if (userAlreadyApproved) {
    const cancelBtn = new ButtonBuilder()
      .setCustomId('cancel-approval')
      .setLabel('Cancel Approval')
      .setStyle(ButtonStyle.Danger);

    row.addComponents(cancelBtn);

    if (isMember) {
      const engageBtn = new ButtonBuilder()
        .setLabel('Engage')
        .setStyle(ButtonStyle.Link)
        .setURL('https://wright.campuslabs.com/engage/actioncenter/organization/esports/roster/Roster/prospective');

      row.addComponents(engageBtn);
    }

    row.addComponents(remindBtn);
  } else {
    if (isMember) {
      const approveBtn = new ButtonBuilder()
        .setCustomId('approve-member')
        .setLabel('Approve Member')
        .setStyle(ButtonStyle.Success);

      const engageBtn = new ButtonBuilder()
        .setLabel('Engage')
        .setStyle(ButtonStyle.Link)
        .setURL('https://wright.campuslabs.com/engage/actioncenter/organization/esports/roster/Roster/prospective');

      row.addComponents(approveBtn, engageBtn, remindBtn);
    } else {
      const approveGuestBtn = new ButtonBuilder()
        .setCustomId('approve-guest')
        .setLabel('Approve Guest')
        .setStyle(ButtonStyle.Secondary);

      row.addComponents(approveGuestBtn, remindBtn);
    }
  }

  if (allowChangeUser) {
    row.addComponents(changeUserBtn);
  }

  return [row];
}

/**
 * Builds the embed for an unmatched registration card presenting candidate suggestions.
 */
export function buildUnmatchedRegistrationEmbed(
  data: RegistrationData,
  similarMatches: SimilarMemberMatch[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle('⚠️ User not found in Discord — Select matching user')
    .setDescription(
      `Could not automatically match **"${data.discordUsername || data.name}"**.\nPlease select the user below from the top suggestions or use the server member picker:`,
    )
    .addFields(
      { name: 'Name', value: data.name },
      { name: 'Submitted Username', value: data.discordUsername || 'N/A' },
      { name: 'Register As', value: data.registerAs === 'guest' ? 'Guest' : 'Member' },
      { name: 'Email', value: data.email || 'N/A' },
      { name: 'Sheet Row', value: data.sheetRow || 'N/A' },
    );

  if (similarMatches.length > 0) {
    const suggestionsText = similarMatches
      .map((m, i) => {
        const matchPercent = Math.round(m.score * 100);
        return `\`${i + 1}.\` <@${m.member.id}> (\`${m.member.user.username}\`) — **${matchPercent}% match**`;
      })
      .join('\n');

    embed.addFields({ name: '🔍 Top Suggestions', value: suggestionsText });
  } else {
    embed.addFields({
      name: '🔍 Suggestions',
      value: '*No close username matches found in server. User may not have joined yet.*',
    });
  }

  if (data.purpose) embed.addFields({ name: 'Purpose of joining', value: data.purpose });
  if (data.discovery) embed.addFields({ name: 'Discovery', value: data.discovery });

  return embed;
}

/**
 * Builds the components (Select Menu, User Picker, Retry Button) for an unmatched registration card.
 */
export function buildUnmatchedActionRows(
  similarMatches: SimilarMemberMatch[],
): (
  | ActionRowBuilder<StringSelectMenuBuilder>
  | ActionRowBuilder<UserSelectMenuBuilder>
  | ActionRowBuilder<ButtonBuilder>
)[] {
  const rows: (
    | ActionRowBuilder<StringSelectMenuBuilder>
    | ActionRowBuilder<UserSelectMenuBuilder>
    | ActionRowBuilder<ButtonBuilder>
  )[] = [];

  // 1. Top suggestions dropdown (if any exist)
  if (similarMatches.length > 0) {
    const stringSelect = new StringSelectMenuBuilder()
      .setCustomId('select-registration-user')
      .setPlaceholder('Select from top 5 similar Discord users...')
      .addOptions(
        similarMatches.map((m, i) => {
          const matchPercent = Math.round(m.score * 100);
          const label = `${i + 1}. ${m.member.displayName} (@${m.member.user.username})`.slice(0, 100);
          const desc = `${matchPercent}% match • Tag: ${m.member.user.tag}`.slice(0, 100);
          return {
            label,
            value: m.member.id,
            description: desc,
            emoji: '👤',
          };
        }),
      );

    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(stringSelect));
  }

  // 2. User Select Menu allowing picking ANY member from server
  const userSelect = new UserSelectMenuBuilder()
    .setCustomId('pick-registration-user')
    .setPlaceholder('Or search & pick any member from server...');

  rows.push(new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect));

  // 3. Retry search button
  const retryBtn = new ButtonBuilder()
    .setCustomId('retry-registration-lookup')
    .setLabel('Retry Search')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🔄');

  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(retryBtn));

  return rows;
}

const REGISTRATION_COMPONENT_IDS = new Set([
  'approve-member',
  'approveMember',
  'approve-guest',
  'approveGuest',
  'cancel-approval',
  'cancelApproval',
  'remind-signup',
  'remind',
  'remind-member',
  'remindMember',
  'change-registration-user',
  'select-registration-user',
  'pick-registration-user',
  'retry-registration-lookup',
]);

/**
 * Checks whether a message has already been enriched with registration buttons or select menus.
 */
export function isMessageAlreadyEnriched(message: Message | undefined): boolean {
  if (!message || !message.components || message.components.length === 0) {
    return false;
  }

  for (const row of message.components) {
    if ('components' in row && Array.isArray(row.components)) {
      for (const component of row.components) {
        if ('customId' in component && component.customId && REGISTRATION_COMPONENT_IDS.has(component.customId)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Validates whether an embed is a valid registration embed.
 * Checks for registration signatures and required form fields (Name, Discord Username, Email/Row).
 */
export function isRegistrationEmbed(embed: Embed | undefined): boolean {
  if (!embed) return false;

  const titleLower = embed.title?.toLowerCase() || '';

  const isKnownTitle =
    titleLower.includes('new member') ||
    titleLower.includes('new guest') ||
    titleLower.includes('registration') ||
    titleLower.includes('signup') ||
    titleLower.includes('sign up') ||
    titleLower.includes('user not found in discord');

  if (!embed.fields || embed.fields.length === 0) {
    return isKnownTitle;
  }

  const normalizedKeys = embed.fields.map((f) => f.name.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const hasName = normalizedKeys.some((k) => k === 'name' || k === 'fullname' || k === 'realname');
  const hasDiscord = normalizedKeys.some(
    (k) =>
      k === 'discord' || k === 'discordusername' || k === 'submittedusername' || k === 'discordtag' || k === 'username',
  );
  const hasOtherRegField = normalizedKeys.some(
    (k) =>
      k === 'email' ||
      k === 'wsuemail' ||
      k === 'sheetrow' ||
      k === 'row' ||
      k === 'registeras' ||
      k === 'registrationtype' ||
      k === 'purposeofjoining' ||
      k === 'purpose',
  );

  return hasName && hasDiscord && (hasOtherRegField || isKnownTitle);
}

export interface EnrichRegistrationResult {
  success: boolean;
  error?: string;
  data?: RegistrationData;
  member?: GuildMember | null;
  sentMessage?: Message;
}

/**
 * Enriches a raw registration message or embed into a formatted interactive registration card.
 */
export async function enrichRegistrationMessage(
  message: Message,
  options: { deleteOriginal?: boolean; force?: boolean } = { deleteOriginal: true, force: false },
): Promise<EnrichRegistrationResult> {
  if (!options.force && isMessageAlreadyEnriched(message)) {
    return {
      success: false,
      error: 'This message is already an enriched registration card.',
    };
  }

  const incomingEmbed = message.embeds[0];
  if (!incomingEmbed) {
    return { success: false, error: 'No embed found in the selected message.' };
  }

  if (!isRegistrationEmbed(incomingEmbed)) {
    return {
      success: false,
      error: 'The selected message is not a valid new registration embed (missing registration fields).',
    };
  }

  const data = extractRegistrationDataFromCard(incomingEmbed);
  if (!data || (!data.name && !data.discordUsername && !data.email)) {
    return {
      success: false,
      error: 'The embed does not contain recognizable registration fields (Name, Discord Username, Email).',
    };
  }

  let member = null;
  if (message.guild && (data.discordUsername || data.name || data.email)) {
    member = await findGuildMember(message.guild, data.discordUsername, { name: data.name, email: data.email });
  }

  const isMember = data.registerAs === 'member';
  let embed: EmbedBuilder;
  let components: (
    | ActionRowBuilder<ButtonBuilder>
    | ActionRowBuilder<StringSelectMenuBuilder>
    | ActionRowBuilder<UserSelectMenuBuilder>
  )[] = [];

  if (!member) {
    const similarMatches = message.guild
      ? await findSimilarGuildMembers(message.guild, data.discordUsername, 5, { name: data.name, email: data.email })
      : [];

    embed = buildUnmatchedRegistrationEmbed(data, similarMatches);
    components = buildUnmatchedActionRows(similarMatches);
  } else {
    const userAlreadyApproved = await isRegistrationAlreadyApproved(member, data.registerAs);
    embed = await buildMatchedRegistrationEmbed(data, member);
    components = buildMatchedActionRows(isMember, userAlreadyApproved, true);
  }

  const channel = message.channel;
  if (!channel || !('send' in channel)) {
    return { success: false, error: 'Channel is not sendable.' };
  }

  const cardContent = formatCardContent(message);

  const sentMessage = await channel.send({
    content: cardContent,
    embeds: [embed],
    components,
  });

  if (options.deleteOriginal) {
    await message.delete().catch(() => {});
  }

  return { success: true, data, member, sentMessage };
}
