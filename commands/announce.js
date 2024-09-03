import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import channelList from '../data/channel-list.json' assert { type: 'json' };

/**
 * @type {import('../typedefs.js').Command}
 */
export default {
    admin: true,
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Sends a message to the set announcement channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // admin perms only
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The channel to announce to')
                .addChannelTypes(ChannelType.AnnouncementThread, ChannelType.GuildText)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('message').setDescription('Message to announcement').setRequired(true)
        )
        .addAttachmentOption((option) =>
            option.setName('attachment').setDescription('Attachment to send')
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
                ephemeral: true
            });
            return;
        }

        // if (!channel) {
        //     interaction.reply({
        //         content:
        //             'Channel not provided and default announcement channel is not set up. \n' +
        //             'Either add a channel to the command option, \n' +
        //             'or use /settings to add a default announcement channel',
        //         ephemeral: true
        //     });
        //     return;
        // }

        const payload = {
            content: message
        };

        if (attachment) payload.files = [attachment];

        channel.send(payload);
        interaction.reply({ content: 'Message Sent!', ephemeral: true });
    }
};
