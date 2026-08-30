import {
  EmbedBuilder,
  MessageFlags,
  WebhookClient,
  type Client,
  type GuildTextBasedChannel,
  type TextBasedChannel,
} from 'discord.js';

import { Config, ConfigKeys } from '../config';
import { AppLogger } from '../logger';

const logger = AppLogger.get('message').child('logger');

interface CachedWebhook {
  client: WebhookClient;
  channelId: string;
  name: string;
}

/**
 * Manages automated WebhookClient creation, caching, duplicate pruning,
 * channel migration cleanup, and message log dispatching.
 */
class MessageLogSinkClass {
  private _cached: CachedWebhook | null = null;

  /**
   * Sends a message log payload (embeds/content) to the configured message log channel
   * using an auto-provisioned WebhookClient, with fallback to standard channel.send.
   */
  public async send(
    client: Client,
    payload: {
      embeds?: EmbedBuilder[];
      content?: string;
    },
  ): Promise<boolean> {
    const channelId = await Config.get(ConfigKeys.Channels.MessageLog);
    if (!channelId) {
      logger.debug('No message-log channel configured (channels.message-log). Skipping message log.');
      return false;
    }

    const webhookName = (await Config.get(ConfigKeys.Webhooks.MessageLog.Name)) || 'Message Logs';

    try {
      const webhookClient = await this._getOrCreateWebhookClient(client, channelId, webhookName);

      if (webhookClient) {
        await webhookClient.send({
          ...payload,
          flags: [MessageFlags.SuppressNotifications],
        });
        return true;
      }

      // Fallback: send directly through Discord channel if webhook is unavailable
      const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextBasedChannel | null;
      if (channel && channel.isSendable()) {
        await channel.send({
          ...payload,
          flags: [MessageFlags.SuppressNotifications],
        });
        return true;
      }

      logger.warn(`Could not send message log to channel ${channelId}: channel not found or not sendable.`);
      return false;
    } catch (error) {
      logger.error(error, `Failed to send message log to channel ${channelId}`);
      return false;
    }
  }

  /**
   * Retrieves an existing cached WebhookClient or provisions one in the target channel.
   */
  private async _getOrCreateWebhookClient(
    client: Client,
    channelId: string,
    webhookName: string,
  ): Promise<WebhookClient | null> {
    if (this._cached && this._cached.channelId === channelId && this._cached.name === webhookName) {
      return this._cached.client;
    }

    const channel = (await client.channels.fetch(channelId).catch(() => null)) as GuildTextBasedChannel | null;
    if (!channel || !('fetchWebhooks' in channel)) {
      return null;
    }

    try {
      const webhooks = await channel.fetchWebhooks();
      const botId = client.user?.id;

      // Filter for webhooks created by this bot application with matching name and valid token
      const matching = webhooks.filter(
        (w) =>
          (w.owner?.id === botId || w.applicationId === client.application?.id) &&
          w.name === webhookName &&
          Boolean(w.token),
      );

      if (matching.size > 0) {
        const primary = matching.first()!;

        // Prune any duplicate bot-created webhooks with the same name
        if (matching.size > 1) {
          logger.info(`Found ${matching.size} webhooks named "${webhookName}". Pruning duplicates...`);
          for (const extra of matching.values()) {
            if (extra.id !== primary.id) {
              await extra.delete('Pruning duplicate message log webhook').catch((err) => {
                logger.warn(err, `Failed to delete duplicate webhook ${extra.id}`);
              });
            }
          }
        }

        const webhookClient = new WebhookClient({ id: primary.id, token: primary.token! });
        this._cached = { client: webhookClient, channelId, name: webhookName };
        return webhookClient;
      }

      // No matching webhook found, create a new one
      logger.info(`Creating new webhook "${webhookName}" in channel <#${channelId}>...`);
      const created = await channel.createWebhook({
        name: webhookName,
        reason: 'Automated message edit and delete logging',
      });

      if (created.token) {
        const webhookClient = new WebhookClient({ id: created.id, token: created.token });
        this._cached = { client: webhookClient, channelId, name: webhookName };
        return webhookClient;
      }

      return null;
    } catch (error) {
      logger.warn(error, `Failed to manage webhooks in channel ${channelId}. Will fall back to standard channel.send.`);
      return null;
    }
  }
}

export const MessageLogSink = new MessageLogSinkClass();
export default MessageLogSink;
