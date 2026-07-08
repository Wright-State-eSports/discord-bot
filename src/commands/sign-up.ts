import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sign-up')
    .setDescription('Command to sign up for a member or guest. Or to set up the buttons')
    .addStringOption((option) =>
      option
        .setName('as')
        .setDescription('Sign up as a member or guest')
        .setRequired(true)
        .addChoices({ name: 'Member', value: 'member' }, { name: 'Guest', value: 'guest' }),
    ),
};
