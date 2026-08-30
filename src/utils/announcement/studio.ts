import type { Message, ThreadChannel } from 'discord.js';

export interface StudioSession {
  targetChannelId: string;
  adminId: string;
  editMessageId?: string;
}

/**
 * In-memory map of active studio threads to their session state.
 */
export const studioThreads = new Map<string, StudioSession>();

/**
 * Checks whether a given thread channel is an active Announcement Studio thread.
 */
export async function isStudioThread(thread: ThreadChannel): Promise<boolean> {
  if (studioThreads.has(thread.id)) {
    return true;
  }
  if (thread.name.startsWith('📝 studio-') || thread.name.startsWith('📝 edit-studio-')) {
    return true;
  }
  return false;
}

/**
 * Resolves the studio session for a studio thread.
 * Checks memory cache first, then inspects starter/preview messages in the thread.
 */
export async function getStudioSession(thread: ThreadChannel): Promise<StudioSession | null> {
  const cached = studioThreads.get(thread.id);
  if (cached) {
    return cached;
  }

  // Look for any bot message with customId containing target channel ID & edit message ID
  try {
    const messages = await thread.messages.fetch({ limit: 15 });
    for (const msg of messages.values()) {
      for (const row of msg.components) {
        if ('components' in row && Array.isArray(row.components)) {
          for (const component of row.components) {
            if ('customId' in component && typeof component.customId === 'string') {
              const updateMatch = component.customId.match(/^announce-studio-update:(\d+):(\d+)/);
              if (updateMatch?.[1] && updateMatch?.[2]) {
                const session: StudioSession = {
                  targetChannelId: updateMatch[1],
                  editMessageId: updateMatch[2],
                  adminId: thread.ownerId || '',
                };
                studioThreads.set(thread.id, session);
                return session;
              }

              const sendMatch = component.customId.match(/^announce-studio-(?:send|change-channel|back):(\d+)/);
              if (sendMatch?.[1]) {
                const session: StudioSession = {
                  targetChannelId: sendMatch[1],
                  adminId: thread.ownerId || '',
                };
                studioThreads.set(thread.id, session);
                return session;
              }
            }
          }
        }
      }
    }
  } catch {
    // Channel fetch failed or no permissions
  }

  return null;
}

/**
 * Resolves the destination target channel ID for a studio thread.
 */
export async function getStudioTargetChannelId(thread: ThreadChannel): Promise<string | null> {
  const session = await getStudioSession(thread);
  return session?.targetChannelId ?? null;
}

/**
 * Fetches the latest non-bot draft message sent in the studio thread.
 */
export async function getLatestDraftMessage(thread: ThreadChannel): Promise<Message | null> {
  try {
    const messages = await thread.messages.fetch({ limit: 25 });
    for (const msg of messages.values()) {
      if (!msg.author.bot && (msg.content.trim() || msg.attachments.size > 0)) {
        return msg;
      }
    }
  } catch {
    // Failed to fetch messages
  }
  return null;
}
