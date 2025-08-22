import { PermissionFlagsBits, SlashCommandBuilder, MessageFlags } from 'discord.js';

/**
 * @type {import('../typedefs.js').Command}
 */
export default {
    admin: true,
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Sends a message to the set channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The channel to send the message to')
                .setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('message').setDescription('The message to send').setRequired(true)
        )
        .addAttachmentOption((option) =>
            option.setName('attachment').setDescription('An optional attachment to send')
        ),

    async execute(interaction) {
        const message = interaction.options.getString('message');

        /**
         * @type {import('discord.js').Channel | false}
         */
        const channel = interaction.options.getChannel('channel');
        const attachment = interaction.options.getAttachment('attachment');

        if (!message && !attachment) {
            interaction.reply({
                content: 'Message or attachment is not provided',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (!channel) {
            interaction.reply({
                content: 'Please provide a channel',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const payload = {
            content: message
        };

        if (attachment) payload.files = [attachment];

        channel.send(payload);
        interaction.reply({ content: 'Message Sent!', flags: MessageFlags.Ephemeral });
    }
};
