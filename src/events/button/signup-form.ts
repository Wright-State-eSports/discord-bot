import { GuildMember, MessageFlags, type ButtonInteraction } from 'discord.js';

import { AppLogger, DiscordLogger, channelCombo, hasRaiderRole, userCombo } from '../../utils';

/** Replies ephemerally with a pre-filled Google Forms sign-up link for the clicking user. */
export async function handleSignUpForm(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'signup-form']);
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

  await DiscordLogger.log(
    logger.info,
    `${userCombo(interaction)} clicked sign-up form button in ${channelCombo(interaction.channel)}`,
  );

  const message =
    'Fill out this pre-filled form. **Your username should be autofilled** and you can skip the first question.\n\n' +
    `[Sign-Up Form](https://docs.google.com/forms/d/e/1FAIpQLSeHGVtR0kDaSaLfJ_4AfNlVNgwOsgvkeM67Z-gieDxd70l5Dg/viewform?usp=pp_url&entry.1322096694=${interaction.user.tag})`;

  await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
}

export default handleSignUpForm;
