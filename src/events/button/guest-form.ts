import { GuildMember, MessageFlags, type ButtonInteraction } from 'discord.js';

import { AppLogger, DiscordLogger, channelCombo, hasGuestRole, hasRaiderRole, userCombo } from '../../utils';

/** Replies ephemerally with a pre-filled Google Forms guest sign-up link for the clicking user. */
export async function handleGuestForm(interaction: ButtonInteraction): Promise<void> {
  const logger = AppLogger.get('events').child(['button', 'guest-form']);
  if (interaction.inGuild() && interaction.member) {
    const member =
      'roles' in interaction.member
        ? (interaction.member as GuildMember)
        : await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    if (member) {
      if (await hasRaiderRole(member)) {
        await interaction.reply({
          content: '✅ You are already registered as a member!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (await hasGuestRole(member)) {
        await interaction.reply({
          content:
            '✅ You are already registered as a guest! If you would like to join as a full member, use `/signup as:member`.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
  }

  await DiscordLogger.log(
    logger.info,
    `${userCombo(interaction)} clicked guest form button in ${channelCombo(interaction.channel)}`,
  );

  const message =
    'Fill out this pre-filled form for guest sign up. **Your username should be autofilled** and you can skip the first question.\n\n' +
    `[Guest Form](https://docs.google.com/forms/d/e/1FAIpQLSdgxrNbHiUvgRc07fX_oByuHkmFiu4c3qpte7QLdUtxcB6u3g/viewform?usp=pp_url&entry.1322096694=${interaction.user.tag})`;

  await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
}

export default handleGuestForm;
