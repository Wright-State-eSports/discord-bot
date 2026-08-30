import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  type ButtonInteraction,
  type EmbedBuilder,
  type RepliableInteraction,
} from 'discord.js';

export interface ConfirmPromptOptions {
  /** The message prompt content */
  content?: string;
  /** Optional embeds to display */
  embeds?: EmbedBuilder[];
  /** Confirm button label (default: 'Confirm') */
  confirmLabel?: string;
  /** Confirm button style (default: ButtonStyle.Danger) */
  confirmStyle?: ButtonStyle;
  /** Cancel button label (default: 'Cancel') */
  cancelLabel?: string;
  /** Cancel button style (default: ButtonStyle.Secondary) */
  cancelStyle?: ButtonStyle;
  /** Time in milliseconds to wait for a response before timing out (default: 30000) */
  timeoutMs?: number;
  /** Whether the message is ephemeral (default: true) */
  ephemeral?: boolean;
}

export interface ConfirmPromptResult {
  confirmed: boolean;
  interaction: ButtonInteraction | null;
}

/**
 * Prompts the user with an interactive Confirm / Cancel button dialog and awaits their response.
 * Automatically cleans up the prompt on timeout or cancellation.
 */
export async function confirmPrompt(
  interaction: RepliableInteraction,
  options: ConfirmPromptOptions = {},
): Promise<ConfirmPromptResult> {
  const {
    content = 'Are you sure you want to proceed?',
    embeds,
    confirmLabel = 'Confirm',
    confirmStyle = ButtonStyle.Danger,
    cancelLabel = 'Cancel',
    cancelStyle = ButtonStyle.Secondary,
    timeoutMs = 30_000,
    ephemeral = true,
  } = options;

  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const confirmId = `confirm_${nonce}`;
  const cancelId = `cancel_${nonce}`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel(confirmLabel).setStyle(confirmStyle),
    new ButtonBuilder().setCustomId(cancelId).setLabel(cancelLabel).setStyle(cancelStyle),
  );

  let message;
  if (interaction.deferred || interaction.replied) {
    message = await interaction.editReply({
      content,
      embeds: embeds ?? [],
      components: [row],
    });
  } else {
    const response = await interaction.reply({
      content,
      embeds: embeds ?? [],
      components: [row],
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
      withResponse: true,
    });
    message = response.resource?.message ?? (await interaction.fetchReply());
  }

  try {
    const confirmation = await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id && (i.customId === confirmId || i.customId === cancelId),
      time: timeoutMs,
    });

    if (confirmation.customId === confirmId) {
      return { confirmed: true, interaction: confirmation };
    }

    await confirmation.update({
      content: '❌ Action cancelled.',
      embeds: [],
      components: [],
    });
    return { confirmed: false, interaction: confirmation };
  } catch {
    await interaction
      .editReply({
        content: '⏱️ Confirmation timed out. Action cancelled.',
        embeds: [],
        components: [],
      })
      .catch(() => null);

    return { confirmed: false, interaction: null };
  }
}
