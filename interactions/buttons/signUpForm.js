import { MessageFlags } from 'discord.js';

/**
 * Handles the sign-up links button interaction
 * @param {import("discord.js").Interaction} interaction
 */
async function signUpForm(interaction) {
    const message =
        'Fill out this pre-filled form. **Your username should be autofilled** and you can skip the first question.\n' +
        `[Sign-Up Form](https://docs.google.com/forms/d/e/1FAIpQLSeHGVtR0kDaSaLfJ_4AfNlVNgwOsgvkeM67Z-gieDxd70l5Dg/viewform?usp=pp_url&entry.1322096694=${interaction.user.tag})`;

    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
}

export default signUpForm;
