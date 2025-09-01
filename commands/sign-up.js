import {
    ChannelType,
    MediaGalleryBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ButtonBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SlashCommandBuilder,
    TextDisplayBuilder,
    ButtonStyle,
    ActionRowBuilder
} from 'discord.js';
import logger from '../utils/loggers/logger.js';
/**
 * @type {import('../typedefs.js').Command}
 */
export default {
    data: new SlashCommandBuilder()
        .setName('sign-up')
        .setDescription(
            'Utility command to sign up for a member or guest. Or to set up the buttons.'
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('member').setDescription('Sign up as a member.')
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('guest').setDescription('Sign up as a guest.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Set up the sign-up buttons in the current channel.')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('The channel to set up the buttons in.')
                        .addChannelTypes(ChannelType.GuildText)
                )
        ),

    async execute(interaction) {
        let message;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        logger.info(
            `User ${interaction.user.tag} (${interaction.user.id}) used the ${interaction.options.getSubcommand()} subcommand.`
        );

        switch (interaction.options.getSubcommand()) {
            case 'setup':
                // If the user doesn't have admin perms, don't let them use the setup subcommand
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    await interaction.editReply({
                        content: 'You do not have permission to use this command.'
                    });
                    return;
                } else {
                    setupButtons(interaction);
                    logger.info(
                        `Buttons setup in <#${interaction.options.getChannel('channel').id}> (${interaction.options.getChannel('channel').name}).`
                    );

                    return;
                }

            case 'member':
                message =
                    'Please sign up and join our engage using this link: https://wright.edu/esports\n\n' +
                    'Fill out this pre-filled form. **Your username should be autofilled** and you can skip the first question.\n' +
                    `[Sign-Up Form](https://docs.google.com/forms/d/e/1FAIpQLSeHGVtR0kDaSaLfJ_4AfNlVNgwOsgvkeM67Z-gieDxd70l5Dg/viewform?usp=pp_url&entry.1322096694=${interaction.user.tag})`;
                break;

            case 'guest':
                message =
                    'Please fill out this form for guest sign up: https://forms.gle/jbBbWaeyYU3qBa6F9';
                break;
        }

        await interaction.editReply({ content: message });
        logger.info(
            `Replied to ${interaction.user.tag} (${interaction.user.id}) with sign-up information.`
        );
    }
};

/**
 *
 * @param {import('discord.js').Interaction} interaction The interaction object
 */
async function setupButtons(interaction) {
    /**
     * @type {import('discord.js').Channel}
     */
    const channel = interaction.options.getChannel('channel');

    if (!channel) {
        await interaction.editReply({
            content: 'Please specify a channel to set up the buttons in.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const separator = new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Large);

    const welcomeMessage = new TextDisplayBuilder().setContent(
        '# Sign Up\n ## Welcome to WSU eSports Server!, to get full access to the server, please follow the directions given below.'
    );
    const engageMessage = new TextDisplayBuilder().setContent(
        '## Engage\n Please join our engage by clicking the button below. When you are redirected, please sign in using your WSU Account, and click on the **Join** button'
    );
    const formMessage = new TextDisplayBuilder().setContent(
        '## Sign-up Form\n Please fill out the form by clicking the button below. **Your username will be autofilled**, so you can skip the first question.'
    );

    const guestMessage = new TextDisplayBuilder().setContent(
        '## Guest Sign-Up Form\n Please fill out the form by clicking on the button below **IF you are signing up as a guest**.'
    );

    const engageImage = new MediaGalleryBuilder().addItems((mediaGalleryItem) =>
        mediaGalleryItem
            .setDescription('Esports engage website')
            .setURL(
                'https://lh7-rt.googleusercontent.com/formsz/AN7BsVD48I_kAIhxwcZgIBRvuHHynoEs5eOL7tj2zyldnHa4BRaqsLJzLiGFF5QI2tNOlMBCJnzEQ3vbEdBXzmGmI9iFCDuWHkOyOVuxl_J7SZkgWCjK1_6yXi8nv4WJ1FOECM9ks7eDgvO9eyl8rVmMz_wjpifiC_obzID-FA?key=jIUoeNRSSSOtI2L2Wue92Q'
            )
    );

    const engageButton = new ButtonBuilder()
        .setLabel('Join Engage!')
        .setStyle(ButtonStyle.Link)
        .setURL('https://wright.edu/esports');
    const engageAction = new ActionRowBuilder().addComponents(engageButton);

    const formButton = new ButtonBuilder()
        .setCustomId('sign-up-form')
        .setLabel('Sign-Up Form')
        .setStyle(ButtonStyle.Success);
    const formAction = new ActionRowBuilder().addComponents(formButton);

    const guestButton = new ButtonBuilder()
        .setLabel('Guest Sign-Up Form')
        .setStyle(ButtonStyle.Link)
        .setURL('https://forms.gle/jbBbWaeyYU3qBa6F9');
    const guestAction = new ActionRowBuilder().addComponents(guestButton);

    await channel.send({
        components: [
            welcomeMessage,
            separator,
            engageMessage,
            engageImage,
            engageAction,
            separator,
            formMessage,
            formAction,
            separator,
            guestMessage,
            guestAction,
            separator
        ],
        flags: MessageFlags.IsComponentsV2
    });

    await interaction.editReply({
        content: `Buttons set up in <#${channel.id}> (${channel.name}).`
    });
}
