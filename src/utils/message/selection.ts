export interface SelectedMessage {
  messageId: string;
  channelId: string;
  previewContent?: string;
  timestamp: number;
}

// Generous 1-hour window for memory cleanup
const DEFAULT_TTL_MS = 60 * 60 * 1000;

export class MessageSelectionManager {
  private cache = new Map<string, SelectedMessage>();

  public set(
    userId: string,
    data: { messageId: string; channelId: string; previewContent?: string },
    ttlMs: number = DEFAULT_TTL_MS,
  ): void {
    // Setting for userId immediately overrides any previous selection for this user
    this.cache.set(userId, {
      ...data,
      timestamp: Date.now() + ttlMs,
    });
  }

  public get(userId: string): SelectedMessage | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;

    if (Date.now() > entry.timestamp) {
      this.cache.delete(userId);
      return null;
    }

    return entry;
  }

  public clear(userId: string): void {
    this.cache.delete(userId);
  }
}

export const MessageSelection = new MessageSelectionManager();
export default MessageSelection;
