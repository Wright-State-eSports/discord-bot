import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and how long it took for the bot to receive the command.'),
  async execute(interaction) {
    const recv = Date.now();
    const sent = interaction.createdTimestamp;
    const diff = recv - sent;
    const embed = new EmbedBuilder()
      .setTitle('Pong!')
      .setDescription(`Response time: ${diff}ms`)
      .setColor(diff < 250 ? 'Green' : diff < 500 ? 'Yellow' : 'Red');

    await interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
