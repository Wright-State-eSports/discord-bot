import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';

import { AppLogger, MessageSelection, channelCombo, userCombo } from '../utils';

/**
 * Message context menu command that marks a bot-authored message for editing.
 * Staff right-click a message, then run /edit-message to update its content or attachment.
 */
export default {
  data: new ContextMenuCommandBuilder()
    .setName('Select Message to Edit')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const logger = AppLogger.get('discord').child(['context-menu', 'select-message']);

    if (!interaction.isMessageContextMenuCommand()) return;

    const targetMessage = interaction.targetMessage;

    if (targetMessage.author.id !== interaction.client.user.id) {
      logger.warn(
        `${userCombo(interaction)} attempted to select a message not authored by the bot: ${targetMessage.id}`,
      );
      await interaction.reply({
        content: '❌ You can only select messages sent by this bot.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const preview = targetMessage.content ? targetMessage.content.slice(0, 50) : '[Attachment/Embed]';

    MessageSelection.set(interaction.user.id, {
      messageId: targetMessage.id,
      channelId: targetMessage.channelId,
      previewContent: preview,
    });

    logger.info(
      `${userCombo(interaction)} selected message ${targetMessage.id} in channel ${channelCombo(targetMessage.channel, targetMessage.channelId)}`,
    );

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel-message-selection')
      .setLabel('Cancel Selection')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✖️');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton);

    const response = await interaction.reply({
      content: `✅ Selected message \`${targetMessage.id}\` in <#${targetMessage.channelId}>.\n\nNow run </edit-message:0> (or type \`/edit-message\`) to update its content and/or attachment.`,
      components: [row],
      flags: MessageFlags.Ephemeral,
      withResponse: true,
    });

    try {
      const buttonInteraction = await response.resource?.message?.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id && i.customId === 'cancel-message-selection',
        time: 300_000, // 5 min button listener
      });

      if (buttonInteraction) {
        MessageSelection.clear(interaction.user.id);
        logger.info(`${userCombo(interaction)} cancelled selection for message ${targetMessage.id}`);
        await buttonInteraction.update({
          content: `🚫 Message selection cleared.`,
          components: [],
        });
      }
    } catch {
      // Collector timed out or message component already handled
    }
  },
} satisfies MessageContextMenuCommand;
