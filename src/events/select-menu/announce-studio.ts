import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChannelSelectMenuInteraction,
} from 'discord.js';

import { AppLogger, studioThreads, userCombo } from '../../utils';

/**
 * Handles channel select menu interaction for changing the announcement destination.
 */
export async function handleAnnounceStudioSelectChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['select-menu', 'announce-studio']);

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    logger.warn(`${userCombo(interaction)} attempted to change announcement channel without permission.`);
    await interaction.reply({
      content: '❌ You do not have permission to manage announcements.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedChannelId = interaction.values[0];
  if (!selectedChannelId) {
    await interaction.reply({
      content: '❌ No channel selected.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.channelId) {
    studioThreads.set(interaction.channelId, {
      targetChannelId: selectedChannelId,
      adminId: interaction.user.id,
    });
  }

  const studioEmbed = new EmbedBuilder()
    .setColor(0x006633)
    .setTitle('📢 Announcement Studio')
    .setDescription(
      `Welcome to your private Announcement Studio!\n\n` +
        `📍 **Destination Channel:** <#${selectedChannelId}>\n\n` +
        `### 📖 How to Use\n` +
        `1. **Type your announcement directly in this chat.** You can use full Markdown formatting, headings (\`#\`, \`##\`), bullet lists, custom emojis, images/attachments, and inline \`@mentions\`.\n` +
        `2. The bot will attach a **🚀 Send Announcement** button directly below your message.\n` +
        `3. You can edit your message in Discord or send a new one at any time before clicking send.\n` +
        `4. Click **🚀 Send Announcement** when ready to publish it directly to <#${selectedChannelId}> as a standard chat message with live pings.\n` +
        `5. You can repeat this process to send multiple announcements in sequence. When you are done, click **Finish & Delete Thread**.\n\n` +
        `### ⚠️ Important Quirks & Gotchas\n` +
        `• **Mention Visibility Quirk:** In Discord, if you \`@mention\` a person or role that has permission to see the parent channel where this thread was created, Discord client-side may automatically grant them visibility into this private thread. To ensure 100% draft privacy, always run \`/announce\` inside an admin-only channel!\n` +
        `• **Changing Destination Channel:** Use the **Change Destination** button below anytime. Switching the destination channel applies to all future messages sent during this studio session.\n` +
        `• **Native Formatting:** Messages are published as native Discord chat messages (no embeds) so that custom formatting, user mentions, and role pings function organically.`,
    )
    .setFooter({ text: 'Wright State eSports • Announcement Studio' });

  const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`announce-studio-change-channel:${selectedChannelId}`)
      .setLabel('Change Destination')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📍'),
    new ButtonBuilder()
      .setCustomId('announce-studio-cancel')
      .setLabel('Cancel & Close')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌'),
  );

  await interaction.update({
    content: null,
    embeds: [studioEmbed],
    components: [controlRow],
  });

  logger.info(
    `${userCombo(interaction)} updated announcement studio destination to <#${selectedChannelId}> in thread ${interaction.channelId}`,
  );
}

export default handleAnnounceStudioSelectChannel;
