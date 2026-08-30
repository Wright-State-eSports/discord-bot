import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, Message, PermissionFlagsBits } from 'discord.js';

import { AppLogger, getStudioSession, isStudioThread, userCombo } from '../../utils';

/**
 * Listens for messages sent by admins inside Announcement Studio private threads.
 * Provides a "Send Announcement" or "Update Announcement" button right below their draft.
 */
export default {
  name: 'announce-studio-message',
  event: Events.MessageCreate,
  execute: async (message: Message): Promise<void> => {
    if (message.author.bot) return;
    if (!message.channel.isThread()) return;
    if (!(await isStudioThread(message.channel))) return;

    const session = await getStudioSession(message.channel);
    if (!session) return;

    const isOwner = session.adminId === message.author.id;
    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) return;

    const logger = AppLogger.get('events').child(['message', 'announce-studio']);

    const body = message.content.trim();
    if (!body && message.attachments.size === 0) return;

    const isEditMode = Boolean(session.editMessageId);

    const controlRow = new ActionRowBuilder<ButtonBuilder>();

    if (isEditMode && session.editMessageId) {
      controlRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`announce-studio-update:${session.targetChannelId}:${session.editMessageId}`)
          .setLabel('Update Announcement')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('announce-studio-cancel')
          .setLabel('Cancel & Delete Thread')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌'),
      );

      await message.reply({
        content: `Ready to update the announcement in <#${session.targetChannelId}>? Click **Update Announcement** below, or edit/retype your message above.`,
        components: [controlRow],
        allowedMentions: { parse: [] },
      });
    } else {
      controlRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`announce-studio-send:${session.targetChannelId}`)
          .setLabel('Send Announcement')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🚀'),
        new ButtonBuilder()
          .setCustomId('announce-studio-cancel')
          .setLabel('Cancel & Delete Thread')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌'),
      );

      await message.reply({
        content: `Ready to post to <#${session.targetChannelId}>? Click **Send Announcement** below, or edit/retype your message above.`,
        components: [controlRow],
        allowedMentions: { parse: [] },
      });
    }

    logger.info(
      `${userCombo(message.author)} drafted ${isEditMode ? 'update' : 'announcement'} in studio for <#${session.targetChannelId}>`,
    );
  },
} satisfies EventHandler<Events.MessageCreate>;
