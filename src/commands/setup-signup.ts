import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MediaGalleryBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type AnyComponentBuilder,
} from 'discord.js';

import { AppLogger, Config, ConfigKeys } from '../utils';

/**
 * Command that posts the member onboarding sign-up card to the current channel.
 * Allowed for Administrators and users with the bot-dev role configured in settings.
 * The card includes Engage, sign-up form, and guest form sections with buttons.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('setup-signup')
    .setDescription('Command to set up the sign up buttons in the current channel'),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const logger = AppLogger.get('discord').child(['command', 'setup-signup']);

    const botDevRoleId = await Config.get(ConfigKeys.Roles.BotDev);
    const member = interaction.member;
    const hasBotDevRole =
      botDevRoleId &&
      member &&
      ('roles' in member
        ? Array.isArray(member.roles)
          ? member.roles.includes(botDevRoleId)
          : member.roles.cache.has(botDevRoleId)
        : false);
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin && !hasBotDevRole) {
      logger.warn(`User ${interaction.user.tag} attempted to use the setup-signup command without permission.`);
      await interaction.editReply({
        content: '❌ You do not have permission to use this command.',
      });
      return;
    }

    const channel = interaction.channel;

    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.warn(`User ${interaction.user.tag} attempted to use the setup-signup command in a non-text channel.`);
      await interaction.editReply({
        content: 'This command can only be used in a text channel.',
      });
      return;
    }

    await interaction.editReply({
      content: 'Setting up the sign up buttons...',
    });

    const items = messages.map((message) => {
      if (typeof message === 'string') {
        return new TextDisplayBuilder().setContent(message);
      }

      return message;
    });

    await channel.send({
      // Builders don't always satisfy the strict runtime types expected by discord.js' send typings,
      // so cast to any to satisfy TypeScript while keeping the builder instances.
      components: items as unknown as any,
      flags: MessageFlags.IsComponentsV2,
    });

    logger.info(
      `User ${interaction.user.tag} is setting up the sign up buttons in channel ${channel.name} (${channel.id}).`,
    );

    await interaction.editReply({
      content: 'Sign up buttons have been set up successfully!',
    });
  },
} satisfies ChatInputCommand;

const separator = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large);
const actionRow = (components: AnyComponentBuilder[]) => new ActionRowBuilder().addComponents(components);

/**
 * This message is a somewhat close look at how the message will be structured.
 *
 * Any buttons will have to be added into the action row.
 */
const messages = [
  '# Sign Up\n' +
    '## Welcome to WSU eSports Server!, to get full access to the server, please follow the directions given below.',

  separator,

  '## Engage\n' +
    'Please join our engage by clicking the button below. When you are redirected, please sign in using your WSU Account, and click on the **Join** button',

  new MediaGalleryBuilder().addItems((item) =>
    item
      .setURL(
        'https://lh7-rt.googleusercontent.com/formsz/AN7BsVD48I_kAIhxwcZgIBRvuHHynoEs5eOL7tj2zyldnHa4BRaqsLJzLiGFF5QI2tNOlMBCJnzEQ3vbEdBXzmGmI9iFCDuWHkOyOVuxl_J7SZkgWCjK1_6yXi8nv4WJ1FOECM9ks7eDgvO9eyl8rVmMz_wjpifiC_obzID-FA?key=jIUoeNRSSSOtI2L2Wue92Q',
      )
      .setDescription('WSU Esports Engage Website'),
  ),
  actionRow([
    new ButtonBuilder()
      .setLabel('Join Engage')
      .setStyle(ButtonStyle.Link)
      .setURL('https://engage.wsu.edu/organization/wsu-esports'),
  ]),

  separator,

  '## Signup Form\n' +
    'Please fill out the form by clicking the button below or using the </signup> member command. \n' +
    '**Your username will be autofilled**, so you can skip the first question.\n' +
    "If this button doesn't work, please ask one of the Officers for help in <#1207448695189282869>",
  actionRow([new ButtonBuilder().setCustomId('signup-form').setLabel('Sign Up Form').setStyle(ButtonStyle.Success)]),

  separator,

  '## Guest Form\n' +
    'Please fill out the form by clicking on the button below or using the </signup> guest command. \n' +
    '**If you are signing up as a guest**.' +
    'Using the commnad will autofill your username, so you can skip the first question.\n',
  actionRow([
    new ButtonBuilder().setLabel('Guest Form').setStyle(ButtonStyle.Link).setURL('https://forms.gle/jbBbWaeyYU3qBa6F9'),
  ]),

  separator,
];
