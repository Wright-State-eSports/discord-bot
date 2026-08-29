import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  GuildMember,
  MessageFlags,
  type ButtonInteraction,
  type Interaction,
  type Message,
  type TextBasedChannel,
} from 'discord.js';

import {
  AppLogger,
  Config,
  ConfigKeys,
  extractNotificationIds,
  extractUserIdFromCard,
  formatNotificationSubtext,
  hasRaiderRole,
  promoteToGuest,
  promoteToRaider,
  revertGuest,
  revertRaider,
  userCombo,
} from '../utils';

/**
 * Handles button interactions for the registration approval workflow.
 * Routes each button's customId to the appropriate handler.
 */
export default {
  name: 'button-interaction',
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction): Promise<void> => {
    if (!interaction.isButton()) return;

    const logger = AppLogger.get('events').child('button-interaction');

    try {
      const customId = interaction.customId;
      logger.debug(`${userCombo(interaction)} clicked button with customId: ${customId}`);

      switch (customId) {
        case 'approve-member':
        case 'approveMember':
          await handleApproveMember(interaction);
          break;

        case 'approve-guest':
        case 'approveGuest':
          await handleApproveGuest(interaction);
          break;

        case 'cancel-approval':
        case 'cancelApproval':
          await handleCancelApproval(interaction);
          break;

        case 'signup-form':
        case 'sign-up-form':
          await handleSignUpForm(interaction);
          break;

        default:
          // Ignore other buttons like local collector buttons ('cancel-message-selection')
          break;
      }
    } catch (error) {
      logger.error(error, `Error executing button interaction ${interaction.customId}:`);
    }
  },
} satisfies EventHandler<Events.InteractionCreate>;

/** Grants the Raider role, removes Not-Signed-Up / Guest, and notifies the help channel and Google Sheet. */
async function handleApproveMember(interaction: ButtonInteraction) {
  const logger = AppLogger.get('events').child(['button', 'approve-member']);
  logger.info(`${userCombo(interaction)} pressed Approve Member`);

  if (!interaction.guild) return;

  const userId = extractUserIdFromCard(interaction);
  if (!userId) {
    logger.warn('Could not extract user ID from registration embed.');
    await interaction.reply({
      content: '❌ Could not find target user ID from the registration card.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  const helpChannelId = (await Config.get(ConfigKeys.Channels.Help)) || '626872024375230492';

  try {
    const member = await interaction.guild.members.fetch(userId);
    await promoteToRaider(member);
    logger.info(`Assigned Raider role to ${member.user.tag} (${member.id})`);

    // Notify help channel and record the message
    let sentMsg: Message | null = null;
    const helpChannel = (await interaction.client.channels
      .fetch(helpChannelId)
      .catch(() => null)) as TextBasedChannel | null;
    if (helpChannel && helpChannel.isSendable()) {
      sentMsg = await helpChannel.send(`<@${userId}>, you are set!`);
    }

    // Notify Google script if configured
    if (process.env.SCRIPT_LINK) {
      const embed = interaction.message.embeds[0];
      const nameField = embed?.fields.find((f) => f.name === 'Name')?.value || '';
      const rowField = embed?.fields.find((f) => f.name === 'Sheet Row')?.value || '';

      await fetch(process.env.SCRIPT_LINK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'approve', name: nameField, rowNum: rowField }),
      }).catch((err) => logger.warn(err, 'Failed to update Google Sheet for member approval'));
    }

    // Switch button to Cancel Approval
    const disapprove = new ButtonBuilder()
      .setCustomId('cancel-approval')
      .setLabel('Cancel Approval')
      .setStyle(ButtonStyle.Danger);

    const engage = new ButtonBuilder()
      .setLabel('Engage')
      .setStyle(ButtonStyle.Link)
      .setURL('https://wright.campuslabs.com/engage/actioncenter/organization/esports/roster/Roster/prospective');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disapprove, engage);

    // Update message content with subtext tracking the approval notification
    const notifText = sentMsg ? formatNotificationSubtext(helpChannelId, sentMsg.id) : '';
    await interaction.editReply({ content: `▬▬▬▬▬▬▬▬▬▬${notifText}`, components: [row] });
    logger.info(`Updated message buttons to Cancel Approval for ${userId}`);
  } catch (err) {
    logger.error(err, `Error approving member ${userId}`);
  }
}

/** Grants the Guest role, removes Not-Signed-Up, and notifies the help channel. */
async function handleApproveGuest(interaction: ButtonInteraction) {
  const logger = AppLogger.get('events').child(['button', 'approve-guest']);
  logger.info(`${userCombo(interaction)} pressed Approve Guest`);

  if (!interaction.guild) return;

  const userId = extractUserIdFromCard(interaction);
  if (!userId) {
    logger.warn('Could not extract user ID from registration embed.');
    await interaction.reply({
      content: '❌ Could not find target user ID from the registration card.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  const helpChannelId = (await Config.get(ConfigKeys.Channels.Help)) || '626872024375230492';

  try {
    const member = await interaction.guild.members.fetch(userId);
    await promoteToGuest(member);
    logger.info(`Assigned Guest role to ${member.user.tag} (${member.id})`);

    // Notify help channel and record the message
    let sentMsg: Message | null = null;
    const helpChannel = (await interaction.client.channels
      .fetch(helpChannelId)
      .catch(() => null)) as TextBasedChannel | null;
    if (helpChannel && helpChannel.isSendable()) {
      sentMsg = await helpChannel.send(`<@${userId}>, you are set!`);
    }

    // Switch button to Cancel Approval
    const disapprove = new ButtonBuilder()
      .setCustomId('cancel-approval')
      .setLabel('Cancel Approval')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disapprove);

    // Update message content with subtext tracking the approval notification
    const notifText = sentMsg ? formatNotificationSubtext(helpChannelId, sentMsg.id) : '';
    await interaction.editReply({ content: `▬▬▬▬▬▬▬▬▬▬${notifText}`, components: [row] });
    logger.info(`Updated message buttons to Cancel Approval for guest ${userId}`);
  } catch (err) {
    logger.error(err, `Error approving guest ${userId}`);
  }
}

/** Reverts an approval — removes the assigned role, deletes the approval notification, and resets the button back to Approve. */
async function handleCancelApproval(interaction: ButtonInteraction) {
  const logger = AppLogger.get('events').child(['button', 'cancel-approval']);
  logger.info(`${userCombo(interaction)} pressed Cancel Approval`);

  if (!interaction.guild) return;

  const userId = extractUserIdFromCard(interaction);
  if (!userId) {
    logger.warn('Could not extract user ID from registration embed.');
    return;
  }

  await interaction.deferUpdate();

  const embed = interaction.message.embeds[0];
  // The embed is the only source of truth at button-click time — we
  // derive the original registration type from the title or a field
  // rather than making another API call.
  const isGuest =
    embed?.title === 'New Guest' ||
    embed?.fields.some((f) => f.name === 'Register As' && f.value.toLowerCase() === 'guest');

  try {
    const member = await interaction.guild.members.fetch(userId);

    // Delete the previous approval notification message if tracked in message content or embed footer
    const notif = extractNotificationIds(interaction);
    if (notif) {
      try {
        const notifChannel = (await interaction.client.channels
          .fetch(notif.channelId)
          .catch(() => null)) as TextBasedChannel | null;
        if (notifChannel && 'messages' in notifChannel) {
          const notifMsg = await notifChannel.messages.fetch(notif.messageId).catch(() => null);
          if (notifMsg) {
            await notifMsg.delete().catch(() => {});
            logger.info(`Deleted approval notification message ${notif.messageId} in channel ${notif.channelId}`);
          }
        }
      } catch (delError) {
        logger.warn(delError, `Failed to delete approval notification message ${notif.messageId}`);
      }
    }

    if (isGuest) {
      await revertGuest(member);
      logger.info(`Reverted Guest roles for ${member.user.tag}`);
    } else {
      await revertRaider(member);
      logger.info(`Reverted Raider roles for ${member.user.tag}`);

      if (process.env.SCRIPT_LINK) {
        const nameField = embed?.fields.find((f) => f.name === 'Name')?.value || '';
        const rowField = embed?.fields.find((f) => f.name === 'Sheet Row')?.value || '';

        await fetch(process.env.SCRIPT_LINK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'disapprove', username: nameField, rowNum: rowField }),
        }).catch((err) => logger.warn(err, 'Failed to update Google Sheet for cancellation'));
      }
    }

    // Reset button back to Approve
    const approve = new ButtonBuilder()
      .setCustomId(isGuest ? 'approve-guest' : 'approve-member')
      .setLabel(isGuest ? 'Approve Guest' : 'Approve Member')
      .setStyle(isGuest ? ButtonStyle.Secondary : ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approve);

    if (!isGuest) {
      const engage = new ButtonBuilder()
        .setLabel('Engage')
        .setStyle(ButtonStyle.Link)
        .setURL('https://wright.campuslabs.com/engage/actioncenter/organization/esports/roster/Roster/prospective');
      row.addComponents(engage);
    }

    // Reset content back to base divider and ensure footer is cleared
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFooter(null);

    await interaction.editReply({
      content: '▬▬▬▬▬▬▬▬▬▬',
      embeds: [updatedEmbed],
      components: [row],
    });
    logger.info(`Reset buttons to Approve for ${userId}`);
  } catch (err) {
    logger.error(err, `Error cancelling approval for ${userId}`);
  }
}

/** Replies ephemerally with a pre-filled Google Forms sign-up link for the clicking user. */
async function handleSignUpForm(interaction: ButtonInteraction) {
  if (interaction.inGuild() && interaction.member) {
    const member =
      'roles' in interaction.member
        ? (interaction.member as GuildMember)
        : await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    if (member && (await hasRaiderRole(member))) {
      await interaction.reply({
        content: '✅ You are already registered as a member!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const message =
    'Fill out this pre-filled form. **Your username should be autofilled** and you can skip the first question.\n\n' +
    `[Sign-Up Form](https://docs.google.com/forms/d/e/1FAIpQLSeHGVtR0kDaSaLfJ_4AfNlVNgwOsgvkeM67Z-gieDxd70l5Dg/viewform?usp=pp_url&entry.1322096694=${interaction.user.tag})`;

  await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
}
