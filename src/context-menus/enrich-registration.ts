import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';

import { AppLogger, DiscordLogger, enrichRegistrationMessage, userCombo } from '../utils';

/**
 * Message context menu command that manually enriches a raw registration embed.
 * Admins right-click a message containing registration data and select "Enrich Registration".
 */
export default {
  data: new ContextMenuCommandBuilder()
    .setName('Enrich Registration')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const logger = AppLogger.get('discord').child(['context-menu', 'enrich-registration']);

    if (!interaction.isMessageContextMenuCommand()) return;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      logger.warn(`${userCombo(interaction)} attempted to use Enrich Registration without permission.`);
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetMessage = interaction.targetMessage;
    logger.info(`${userCombo(interaction)} triggered Enrich Registration on message ${targetMessage.id}`);

    try {
      const result = await enrichRegistrationMessage(targetMessage, { deleteOriginal: true, force: true });

      if (!result.success) {
        logger.warn(`Manual enrichment failed for message ${targetMessage.id}: ${result.error}`);
        await interaction.editReply({
          content: `❌ Could not enrich registration: ${result.error}`,
        });
        return;
      }

      const userDetail = result.member ? `<@${result.member.id}> (${result.member.user.tag})` : 'unmatched user';
      logger.info(`Manual enrichment succeeded for ${result.data?.name} (${userDetail})`);

      await DiscordLogger.log(
        logger.info,
        `${userCombo(interaction)} manually enriched registration card for **${result.data?.name}** (${result.data?.discordUsername || 'N/A'})`,
      );

      await interaction.editReply({
        content: `✅ Successfully enriched registration card for **${result.data?.name}**!`,
      });
    } catch (error) {
      logger.error(error, `Error during manual registration enrichment for message ${targetMessage.id}:`);
      await interaction.editReply({
        content: '❌ An error occurred while enriching the registration embed.',
      });
    }
  },
} satisfies MessageContextMenuCommand;
