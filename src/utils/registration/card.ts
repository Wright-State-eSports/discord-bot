import type { ButtonInteraction, Embed, Message } from 'discord.js';

/**
 * Extracts a Discord user ID from the registration card embed's 'Discord @' field or other mention format.
 */
export function extractUserIdFromCard(source: ButtonInteraction | Message | Embed | undefined): string | null {
  if (!source) return null;

  let embed: Embed | undefined;
  if ('embeds' in source) {
    embed = source.embeds[0];
  } else if ('fields' in source) {
    embed = source as Embed;
  }

  if (!embed) return null;

  const mentionField = embed.fields.find((f) => f.name === 'Discord @');
  if (mentionField) {
    const match = mentionField.value.match(/<@!?(\d+)>/);
    if (match) return match[1];
  }

  // Fallback: check any field with mention
  for (const field of embed.fields) {
    const match = field.value.match(/<@!?(\d+)>/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extracts the approval notification channel ID and message ID from the message content (-# subtext) or embed footer.
 */
export function extractNotificationIds(
  source: ButtonInteraction | Message | undefined,
): { channelId: string; messageId: string } | null {
  if (!source) return null;

  const message = 'message' in source ? source.message : source;
  const content = message.content || '';
  const match = content.match(/Notification:\s*(\d+)\/(\d+)/);
  if (match) {
    return { channelId: match[1], messageId: match[2] };
  }

  const embed = message.embeds[0];
  const target = embed?.footer?.text || '';
  const footerMatch = target.match(/Notification:\s*(\d+)\/(\d+)/);
  if (footerMatch) {
    return { channelId: footerMatch[1], messageId: footerMatch[2] };
  }

  return null;
}

/**
 * Formats notification metadata as tiny subtext (-#) for message content.
 */
export function formatNotificationSubtext(channelId: string, messageId: string): string {
  return `\n-# Notification: ${channelId}/${messageId}`;
}
