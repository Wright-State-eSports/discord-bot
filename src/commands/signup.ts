import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { AppLogger, type AppLoggerInstance } from '../utils/logger';

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
          `User ${interaction.user.tag} attempted to use the signup command with an invalid option: ${signupType}`,
        );
        await interaction.reply({
          content: 'Invalid option. Please choose either "member" or "guest".',
          flags: MessageFlags.Ephemeral,
        });
    }
  },
} satisfies Command;

async function handleMemberSignup(interaction: ChatInputCommandInteraction, logger: AppLoggerInstance) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const message =
    'Please sign up and join our engage using this link: https://wright.edu/esports\n\n' +
    'Fill out this pre-filled form. **Your username should be autofilled** and you can skip the first question.\n' +
    `[Sign-Up Form](https://docs.google.com/forms/d/e/1FAIpQLSeHGVtR0kDaSaLfJ_4AfNlVNgwOsgvkeM67Z-gieDxd70l5Dg/viewform?usp=pp_url&entry.1322096694=${interaction.user.tag})`;
  logger.info(`Sent Member Signup Message to ${interaction.user.tag}`);

  await interaction.editReply({ content: message });
}

async function handleGuestSignup(interaction: ChatInputCommandInteraction, logger: AppLoggerInstance) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const message = 'Please fill out this form for guest sign up: https://forms.gle/jbBbWaeyYU3qBa6F9';
  logger.info(`Sent Guest Signup Message to ${interaction.user.tag}`);

  await interaction.editReply({ content: message });
}
