import { Events, Message, type Client, type TextBasedChannel } from 'discord.js';

import { AppLogger, Config, ConfigKeys, channelCombo, enrichRegistrationMessage } from '../utils';

const logger = AppLogger.get('events').child('new-register');

/**
 * Listens for new messages and processes any incoming Google Script registration webhooks.
 */
export default {
  name: 'new-register',
  event: Events.MessageCreate,
  execute: async (message: Message) => {
    await processRegistrationWebhook(message);
  },
} satisfies EventHandler<Events.MessageCreate>;

/**
 * Enriches an incoming Google Script webhook registration message by posting
 * the formatted embed with interactive buttons and deleting the raw webhook message.
 */
export async function processRegistrationWebhook(message: Message, webhookId?: string): Promise<boolean> {
  const resolvedWebhookId = webhookId || (await Config.get(ConfigKeys.Webhooks.NewRegister.Id));

  if (!resolvedWebhookId || message.webhookId !== resolvedWebhookId) {
    return false;
  }

  try {
    const result = await enrichRegistrationMessage(message, { deleteOriginal: true });
    if (!result.success) {
      logger.warn(`Failed to enrich webhook message (${message.id}): ${result.error}`);
      return false;
    }

    logger.info(
      `Successfully posted enriched registration card for: ${result.data?.discordUsername || result.data?.name}`,
    );
    return true;
  } catch (err) {
    logger.error(err, `Error occurred while processing new register webhook (${message.id}):`);
    return false;
  }
}

/**
 * Sweeps the registration channel on startup for unprocessed webhook messages.
 */
export async function sweepUnprocessedRegistrations(client: Client): Promise<void> {
  const sweepLogger = AppLogger.get('events').child(['new-register', 'startup-sweep']);
  const webhookId = await Config.get(ConfigKeys.Webhooks.NewRegister.Id);
  const channelId = await Config.get(ConfigKeys.Webhooks.NewRegister.ChannelId);
  const limit = (await Config.get(ConfigKeys.Webhooks.NewRegister.SweepLimit)) ?? 25;

  if (!webhookId || !channelId) {
    sweepLogger.debug('Webhook ID or channel-id not configured for startup sweep. Skipping.');
    return;
  }

  try {
    const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextBasedChannel | null;
    if (!channel || !channel.isTextBased()) {
      sweepLogger.warn(`Registration channel (${channelId}) not found or is not text-based.`);
      return;
    }

    sweepLogger.info(
      `Sweeping up to ${limit} recent messages in ${channelCombo(channel, channelId)} for unprocessed registrations...`,
    );
    const messages = await channel.messages.fetch({ limit });

    // Webhook messages in this channel from the registration webhook that haven't been replaced yet
    const unprocessed = messages.filter((m) => m.webhookId === webhookId);

    if (unprocessed.size === 0) {
      sweepLogger.info('Startup sweep complete: No unprocessed registration webhooks found.');
      return;
    }

    sweepLogger.info(`Found ${unprocessed.size} unprocessed registration webhooks to enrich.`);
    for (const msg of unprocessed.values()) {
      await processRegistrationWebhook(msg, webhookId);
    }

    sweepLogger.info(`Startup sweep successfully processed ${unprocessed.size} registration messages.`);
  } catch (error) {
    sweepLogger.error(error, 'Error during startup registration sweep:');
  }
}
