import { SlashCommandBuilder, ChannelType } from 'discord.js';
import channelList from '../data/channel-list.json' assert { type: 'json' };

/**
 * @type {import('../typedefs.js').Command}
 */
export default {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Sends a message to the set announcement channel')
        .addStringOption((option) =>
            option.setName('message').setDescription('Message to announcement')
        )
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The channel to announce to')
                .addChannelTypes(ChannelType.AnnouncementThread, ChannelType.GuildText)
        )
        .addAttachmentOption((option) =>
            option.setName('attachment').setDescription('Attachment to send')
        ),

    async execute(interaction) {
        const message = interaction.options.getString('message');

        /**
         * @type {import('discord.js').Channel | false}
         */
        const channel =
            interaction.options.getChannel('channel') ??
            channelList['announcements']['default'] ??
            false;
        const attachment = interaction.options.getAttachment('attachment');

        if (!message && !attachment) {
            interaction.reply({
                content: 'Message or attachment is not provided',
                ephemeral: true
            });
            return;
        }

        if (!channel) {
            interaction.reply({
                content:
                    'Channel not provided and default announcement channel is not set up. \n' +
                    'Either add a channel to the command option, \n' +
                    'or use /settings to add a default announcement channel',
                ephemeral: true
            });
            return;
        }

        channel.send({ content: message, files: [attachment] });
        interaction.reply({ content: 'Message Sent!', ephemeral: true });
    }
};
