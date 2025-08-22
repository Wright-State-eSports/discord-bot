import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } from 'discord.js';

/**
 * @type { import('../typedefs.js').Command }
 */
export default {
    admin: true,
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Waits for a respond that will be sent to the announcement channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // admin perms only
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The channel to announce to')
                .addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)
                .setRequired(true)
        ),
    async execute(interaction) {
        /**
         * @type {import('discord.js').Channel | false}
         */
        const channel = interaction.options.getChannel('channel');
        // const attachment = interaction.options.getAttachment('attachment');

        if (!channel) {
            interaction.reply({
                content: 'Please provide a channel',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const getResponse = await interaction.reply({
            content: 'Waiting for your message... You will have 20 seconds to respond.',
            flags: MessageFlags.Ephemeral,
            withResponse: true
        });

        let response;

        try {
            response = await getResponse.resource.message.channel.awaitMessages({
                filter: (m) => m.author.id === interaction.user.id,
                max: 1,
                time: 20_000,
                errors: ['time']
            });
            interaction.editReply('Message received!');
        } catch (e) {
            interaction.editReply('Times up... Re run the command to try again.');
            return;
        }

        const msg = response.first();
        const message = msg.content;
        const attachments = msg.attachments;

        channel.send({ content: message, attachments });
        interaction.editReply({
            content: `Message Sent in <#${channel.id}>`
        });
    }
};
