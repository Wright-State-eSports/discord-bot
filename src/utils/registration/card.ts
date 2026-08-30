import type { ButtonInteraction, Embed, Message } from 'discord.js';

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
