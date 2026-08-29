import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  Events,
  Message,
  type Client,
  type TextBasedChannel,
} from 'discord.js';

import { AppLogger, Config, ConfigKeys, findGuildMember, isRegistrationAlreadyApproved } from '../utils';

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
    const incomingEmbed = message.embeds[0];
    if (!incomingEmbed) {
      logger.warn(`No embed found in webhook message: ${message.id}`);
      return false;
    }

    const fields = incomingEmbed.fields.reduce(
      (acc, field) => {
        acc[field.name] = field.value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const name = fields['Name'] || fields['Full Name'] || 'Unknown';
    const discordUsername = fields['Discord Username'] || fields['Username'] || fields['Discord Tag'] || '';
    const email = fields['Email'] || fields['WSU Email'] || '';
    const registerAs = (fields['Register As'] || fields['Registration Type'] || 'member').toLowerCase();
    const sheetRow = fields['Sheet Row'] || '';
    const purpose = fields['Purpose'] || fields['Purpose of joining'];
    const discovery = fields['Discovery'];

    logger.info(
      `Processing registration - Name: ${name}, Username: ${discordUsername}, Type: ${registerAs}, Row: ${sheetRow}`,
    );

    let member = null;
    if (message.guild && discordUsername) {
      member = await findGuildMember(message.guild, discordUsername);
    }

    const isMember = registerAs === 'member';
    const userAlreadyApproved = Boolean(member && (await isRegistrationAlreadyApproved(member, registerAs)));

    const enrichedEmbed = new EmbedBuilder();

    if (!member) {
      logger.warn(`User ${discordUsername} not found in Discord server.`);
      enrichedEmbed
        .setColor(Colors.Red)
        .setTitle('User not found in Discord')
        .addFields(
          { name: 'Name', value: name },
          { name: 'Discord Username', value: discordUsername || 'N/A' },
          { name: 'Email', value: email || 'N/A' },
          { name: 'Sheet Row', value: sheetRow || 'N/A' },
        );

      if (purpose) enrichedEmbed.addFields({ name: 'Purpose of joining', value: purpose });
      if (discovery) enrichedEmbed.addFields({ name: 'Discovery', value: discovery });
    } else {
      logger.info(`User found in guild: ${member.user.tag} (${member.id})`);
      enrichedEmbed
        .setColor(isMember ? Colors.Green : Colors.Grey)
        .setTitle(isMember ? 'New Member' : 'New Guest')
        .setThumbnail(member.displayAvatarURL())
        .addFields(
          { name: 'Name', value: name },
          { name: 'Discord @', value: `<@${member.id}>` },
          { name: 'Discord Username', value: member.user.username || member.user.tag },
          { name: 'Email', value: email || 'N/A' },
          { name: 'Sheet Row', value: sheetRow || 'N/A' },
        );

      if (purpose) enrichedEmbed.addFields({ name: 'Purpose of joining', value: purpose });
      if (discovery) enrichedEmbed.addFields({ name: 'Discovery', value: discovery });
    }

    const row = new ActionRowBuilder<ButtonBuilder>();

    if (member) {
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

          row.addComponents(approveBtn, engageBtn);
        } else {
          const approveGuestBtn = new ButtonBuilder()
            .setCustomId('approve-guest')
            .setLabel('Approve Guest')
            .setStyle(ButtonStyle.Secondary);

          row.addComponents(approveGuestBtn);
        }
      }
    }

    const channel = message.channel;
    if (!channel || !('send' in channel)) {
      logger.warn(`Channel for message ${message.id} is not sendable.`);
      return false;
    }

    await channel.send({
      content: '▬▬▬▬▬▬▬▬▬▬',
      embeds: [enrichedEmbed],
      components: row.components.length > 0 ? [row] : [],
    });

    await message.delete().catch((delErr) => {
      logger.warn(delErr, `Failed to delete original webhook message: ${message.id}`);
    });

    logger.info(`Successfully posted enriched registration card for: ${discordUsername || name}`);
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

    sweepLogger.info(`Sweeping up to ${limit} recent messages in <#${channelId}> for unprocessed registrations...`);
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
