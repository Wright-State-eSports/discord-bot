import type pino from 'pino';

import {
  EmbedBuilder,
  MessageFlags,
  WebhookClient,
  type APIEmbed,
  type Client,
  type GuildTextBasedChannel,
  type HexColorString,
  type TextBasedChannel,
  type WebhookMessageCreateOptions,
} from 'discord.js';

import { Config, ConfigKeys } from '../config';
import { AppLogger, type TaggedLogFn } from './app';

export type DiscordLoggerFn = (
  logger: pino.LogFn,
  useEmbeds: boolean,
  ...args: Parameters<pino.LogFn>
) => Promise<void>;

export interface DiscordLogEmbedArgs {
  error?: unknown;
  options?: APIEmbed;
  /** Whether to suppress Discord notifications. Defaults to `true`. */
  quiet?: boolean;
}

export interface DiscordLogMessageArgs {
  error?: unknown;
  /** Whether to suppress Discord notifications. Defaults to `true`. */
  quiet?: boolean;
}

/**
 * Manages automated In-Discord logging via dynamic WebhookClient provisioning,
 * duplicate webhook pruning, queueing, and fallback to direct channel dispatch.
 */
export class DiscordLogger {
  private static readonly LEVEL_COLOR_MAP: Record<number, HexColorString> = {
    30: '#3498DB', // Info
    40: '#f59e0b', // Warn
    50: '#ef4444', // Error
    60: '#b91c1c', // Fatal
  };

  private static readonly LEVEL_NAME_MAP: Record<number, string> = {
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR',
    60: 'FATAL',
  };

  private static client: Client | null = null;
  private static cachedWebhook: { client: WebhookClient; channelId: string; name: string } | null = null;
  private static queue: Array<() => Promise<void>> = [];
  private static hookLogger = new AppLogger(['discord', 'webhook-logger']);

  /**
   * Sets the Discord client instance and drains queued messages.
   */
  public static setClient(client: Client): void {
    this.client = client;
    void this._flushQueue();
  }

  /**
   * Initializes the dynamic in-Discord logger and binds the client if provided.
   */
  public static async init(client?: Client): Promise<boolean> {
    if (client) {
      this.client = client;
      void this._flushQueue();
    }
    return true;
  }

  /**
   * Sends an embed to the Discord webhook or logs channel with the specified message and color.
   * Notifications are suppressed by default; pass `{ quiet: false }` to alert channel members.
   */
  public static async embed(logger: TaggedLogFn, msg: string, args?: DiscordLogEmbedArgs) {
    const { error: err, options, quiet = true } = args ?? {};
    const level = logger.level ?? 30;

    // Send the log to the Pino logger first
    await this._sendToLogger(logger, msg, err);

    const task = async () => {
      await this._sendEmbed(
        msg,
        this.LEVEL_COLOR_MAP[level] ?? '#000000',
        options,
        quiet ? MessageFlags.SuppressNotifications : undefined,
      );
    };

    if (!this.client) {
      this.queue.push(task);
    } else {
      await task();
    }
  }

  /**
   * Sends a regular message to the Discord webhook with level prefix: [LEVEL] Message.
   * Notifications are suppressed by default; pass `{ quiet: false }` to alert channel members.
   */
  public static async log(logger: TaggedLogFn, msg: string, args?: { quiet?: boolean }) {
    const { quiet = true } = args ?? {};
    const level = logger.level ?? 30;

    // Send the log to the Pino logger first
    await this._sendToLogger(logger, msg);

    const task = async () => {
      await this._sendMessage(
        `[${this.LEVEL_NAME_MAP[level] ?? 'UNKNOWN'}] ${msg}`,
        quiet ? MessageFlags.SuppressNotifications : undefined,
      );
    };

    if (!this.client) {
      this.queue.push(task);
    } else {
      await task();
    }
  }

  /**
   * Sends a regular message to the Discord webhook.
   * Notifications are suppressed by default; pass `{ quiet: false }` to alert channel members.
   */
  public static async message(logger: TaggedLogFn, msg: string, args?: DiscordLogMessageArgs) {
    const { error: err, quiet = true } = args ?? {};

    // Send the log to the Pino logger first
    await this._sendToLogger(logger, msg, err);

    const task = async () => {
      await this._sendMessage(msg, quiet ? MessageFlags.SuppressNotifications : undefined);
    };

    if (!this.client) {
      this.queue.push(task);
    } else {
      await task();
    }
  }

  private static async _flushQueue(): Promise<void> {
    if (!this.client || this.queue.length === 0) return;
    const items = [...this.queue];
    this.queue = [];
    for (const task of items) {
      try {
        await task();
      } catch (err) {
        this.hookLogger.error(err, 'Error executing queued log task:');
      }
    }
  }

  private static async _getOrCreateWebhookClient(): Promise<WebhookClient | null> {
    if (!this.client) return null;

    const channelId = await Config.get(ConfigKeys.Channels.Logs);
    if (!channelId) return null;

    const webhookName = (await Config.get(ConfigKeys.Webhooks.Logs.Name)) || 'Bot Logs';

    if (this.cachedWebhook && this.cachedWebhook.channelId === channelId && this.cachedWebhook.name === webhookName) {
      return this.cachedWebhook.client;
    }

    const channel = (await this.client.channels.fetch(channelId).catch(() => null)) as GuildTextBasedChannel | null;
    if (!channel || !('fetchWebhooks' in channel)) return null;

    try {
      const webhooks = await channel.fetchWebhooks();
      const botId = this.client.user?.id;

      const matching = webhooks.filter(
        (w) =>
          (w.owner?.id === botId || w.applicationId === this.client?.application?.id) &&
          w.name === webhookName &&
          Boolean(w.token),
      );

      if (matching.size > 0) {
        const primary = matching.first()!;

        // Prune duplicates
        if (matching.size > 1) {
          this.hookLogger.info(`Found ${matching.size} webhooks named "${webhookName}". Pruning duplicates...`);
          for (const extra of matching.values()) {
            if (extra.id !== primary.id) {
              await extra.delete('Pruning duplicate log webhook').catch(() => null);
            }
          }
        }

        const webhookClient = new WebhookClient({ id: primary.id, token: primary.token! });
        this.cachedWebhook = { client: webhookClient, channelId, name: webhookName };
        return webhookClient;
      }

      // Create new webhook
      this.hookLogger.info(`Creating new webhook "${webhookName}" in channel <#${channelId}>...`);
      const created = await channel.createWebhook({
        name: webhookName,
        reason: 'Automated Bot In-Discord Logging',
      });

      if (created.token) {
        const webhookClient = new WebhookClient({ id: created.id, token: created.token });
        this.cachedWebhook = { client: webhookClient, channelId, name: webhookName };
        return webhookClient;
      }

      return null;
    } catch (error) {
      this.hookLogger.warn(
        error,
        `Failed to manage webhooks in log channel ${channelId}. Will fallback to channel.send.`,
      );
      return null;
    }
  }

  private static async _sendEmbed(
    msg: string,
    color: HexColorString,
    args?: Omit<APIEmbed, 'description' | 'color'>,
    flags: WebhookMessageCreateOptions['flags'] = MessageFlags.SuppressNotifications,
  ): Promise<void> {
    const embed = EmbedBuilder.from(args ?? {})
      .setDescription(msg)
      .setColor(color)
      .setTimestamp();

    try {
      const webhookClient = await this._getOrCreateWebhookClient();
      if (webhookClient) {
        await webhookClient.send({ embeds: [embed], flags });
        return;
      }

      // Fallback: direct channel send
      if (this.client) {
        const channelId = await Config.get(ConfigKeys.Channels.Logs);
        if (channelId) {
          const channel = (await this.client.channels.fetch(channelId).catch(() => null)) as TextBasedChannel | null;
          if (channel && channel.isSendable()) {
            await channel.send({ embeds: [embed], flags: [flags as number] });
          }
        }
      }
    } catch (error) {
      this.hookLogger.error(error, 'Failed to send embed log message to Discord.');
    }
  }

  private static async _sendMessage(
    msg: string,
    flags: WebhookMessageCreateOptions['flags'] = MessageFlags.SuppressNotifications,
  ): Promise<void> {
    try {
      const webhookClient = await this._getOrCreateWebhookClient();
      if (webhookClient) {
        await webhookClient.send({ content: msg, flags });
        return;
      }

      // Fallback: direct channel send
      if (this.client) {
        const channelId = await Config.get(ConfigKeys.Channels.Logs);
        if (channelId) {
          const channel = (await this.client.channels.fetch(channelId).catch(() => null)) as TextBasedChannel | null;
          if (channel && channel.isSendable()) {
            await channel.send({ content: msg, flags: [flags as number] });
          }
        }
      }
    } catch (error) {
      this.hookLogger.error(error, 'Failed to send log message to Discord.');
    }
  }

  private static async _sendToLogger(logger: TaggedLogFn, msg: string, err: unknown = {}): Promise<void> {
    logger(err, msg);
  }
}

export default DiscordLogger;
