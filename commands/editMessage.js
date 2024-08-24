import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

/**
 * @type {import('../typedefs').Command}
 */
export default {
    admin: true,
    data: new SlashCommandBuilder()
        .setName('editmessage')
        .setDescription('Edits a sent message by this bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The channel the message is located')
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('message_id')
                .setDescription('The message ID to be edited')
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('edited_message')
                .setDescription('The message that will replace the original text')
                .setRequired(true)
        ),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const messageID = interaction.options.getString('message_id');
        const newMessage = interaction.options.getString('edited_message');

        const oldMessage = await channel.messages.fetch(messageID);
        oldMessage.edit(newMessage);

        await interaction.reply({ content: 'Message edited', ephemeral: true });
    }
};
