export interface ActiveInteractionInfo {
  id: string;
  type: 'chat-input' | 'context-menu' | 'button';
  name: string;
  userId: string;
  userTag: string;
  channelId?: string;
  startedAt: number;
}

/**
 * In-flight interaction tracker.
 * Tracks running commands/interactions with high-resolution performance timing.
 */
export class InteractionTracker {
  private static active = new Map<string, ActiveInteractionInfo>();

  /**
   * Starts tracking an interaction and returns elapsed/end timing helpers.
   */
  public static start(
    id: string,
    info: Omit<ActiveInteractionInfo, 'id' | 'startedAt'>,
  ): { end: () => number; elapsed: () => number } {
    const startedAt = performance.now();
    this.active.set(id, { id, ...info, startedAt });

    return {
      elapsed: () => Math.round(performance.now() - startedAt),
      end: () => {
        const duration = Math.round(performance.now() - startedAt);
        this.active.delete(id);
        return duration;
      },
    };
  }

  /**
   * Retrieves all currently in-flight interactions.
   */
  public static getActive(): ActiveInteractionInfo[] {
    return Array.from(this.active.values());
  }

  /**
   * Returns the count of active in-flight interactions.
   */
  public static count(): number {
    return this.active.size;
  }
}

export default InteractionTracker;
