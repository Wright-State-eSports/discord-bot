import { ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { AppLogger, hasGuestRole, hasRaiderRole, userCombo, type AppLoggerInstance } from '../utils';

/**
 * Sends the appropriate sign-up form link based on whether the user is registering as a member or a guest.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('signup')
    .setDescription('Command to sign up for a member or guest. Or to set up the buttons')
    .addStringOption((option) =>
      option
        .setName('as')
        .setDescription('Sign up as a member or guest')
        .setRequired(true)
        .addChoices({ name: 'Member', value: 'member' }, { name: 'Guest', value: 'guest' }),
    ),
  async execute(interaction) {
    const logger = AppLogger.get('discord').child(['command', 'signup']);

    const signupType = interaction.options.getString('as');

    switch (signupType) {
      case 'member':
        await handleMemberSignup(interaction, logger);
        break;
      case 'guest':
        await handleGuestSignup(interaction, logger);
        break;
      default:
        logger.warn(
          `User ${userCombo(interaction)} attempted to use the signup command with an invalid option: ${signupType}`,
        );
        await interaction.reply({
          content: 'Invalid option. Please choose either "member" or "guest".',
          flags: MessageFlags.Ephemeral,
        });
    }
  },
} satisfies ChatInputCommand;

/** Replies with the member sign-up form link, pre-filled with the user's Discord tag. */
async function handleMemberSignup(interaction: ChatInputCommandInteraction, logger: AppLoggerInstance) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (interaction.inGuild() && interaction.member) {
    const member =
      'roles' in interaction.member
        ? (interaction.member as GuildMember)
        : await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    if (member && (await hasRaiderRole(member))) {
      logger.info(`User ${userCombo(interaction)} attempted to sign up as a member, but is already a member.`);
      await interaction.editReply({
        content: '✅ You are already registered as a member!',
      });
      return;
    }
  }

  // '?usp=pp_url&entry.1322096694' is important, as it is how we can prefill their discord username
  const message =
    'Please sign up and join our engage using this link: https://wright.edu/esports\n\n' +
    'Fill out this pre-filled form. **Your username should be autofilled** and you can skip the first question.\n' +
    `[Sign-Up Form](https://docs.google.com/forms/d/e/1FAIpQLSeHGVtR0kDaSaLfJ_4AfNlVNgwOsgvkeM67Z-gieDxd70l5Dg/viewform?usp=pp_url&entry.1322096694=${interaction.user.tag})`;
  logger.info(`Sent Member Signup Message to ${userCombo(interaction)}`);

  await interaction.editReply({ content: message });
}

/** Replies with the guest sign-up form link. */
async function handleGuestSignup(interaction: ChatInputCommandInteraction, logger: AppLoggerInstance) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (interaction.inGuild() && interaction.member) {
    const member =
      'roles' in interaction.member
        ? (interaction.member as GuildMember)
        : await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    if (member) {
      if (await hasRaiderRole(member)) {
        logger.info(`User ${userCombo(interaction)} attempted to sign up as a guest, but is already a member.`);
        await interaction.editReply({
          content: '✅ You are already registered as a member!',
        });
        return;
      }

      if (await hasGuestRole(member)) {
        logger.info(`User ${userCombo(interaction)} attempted to sign up as a guest, but is already a guest.`);
        await interaction.editReply({
          content:
            '✅ You are already registered as a guest! If you would like to join as a full member, use `/signup as:member`.',
        });
        return;
      }
    }
  }

  // '?usp=pp_url&entry.1322096694' is important, as it is how we can prefill their discord username
  const message = `Please fill out this form for guest sign up: https://docs.google.com/forms/d/e/1FAIpQLSdgxrNbHiUvgRc07fX_oByuHkmFiu4c3qpte7QLdUtxcB6u3g/viewform?usp=pp_url&entry.1322096694=${interaction.user.tag}`;
  logger.info(`Sent Guest Signup Message to ${userCombo(interaction)}`);

  await interaction.editReply({ content: message });
}
