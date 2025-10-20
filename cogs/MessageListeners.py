"""
Listeners for various events.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from discord.ext import commands
from loguru import logger
from discord import Embed

# Type hint imports
from discord import Colour, RawMessageUpdateEvent

from utils.config import ConfigOptions, get_config


async def setup(bot: commands.Bot):
    """Setup the Listeners cog."""
    await bot.add_cog(MessageListeners(bot))


class MessageListeners(commands.Cog):
    """Listeners for various events."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    def unload(self):
        logger.info('Unloading MessageListeners cog')
        super().cog_unload()
        logger.success('MessageListeners unloaded')

    @logger.catch
    @commands.Cog.listener()
    async def on_raw_message_edit(self, payload: RawMessageUpdateEvent):
        """
        Log edited messages by receiving raw data from Discord.

        First check if the message is cached to show a more useful edited message log
        using the payload data given by Discord.
        """

        # First ignore bot messages
        if payload.data['member']['user']['bot']:
            return

        # Then fetch the message to get the most up-to-date content
        message_id = payload.message_id
        cached = payload.cached_message is not None

        # Fetch the channel and message
        # and ensure channel exists (should always be true)
        channel = self.bot.get_channel(payload.channel_id)

        if channel is None:
            logger.error('Channel not found, cannot log edited message')
            return

        # Get the before and after messages
        # but the before message may be None if not cached
        after = await channel.fetch_message(message_id)
        before = payload.cached_message

        # Ignore embed-only edits (like link previews)
        if cached and (after.embeds != before.embeds):
            return

        description = (
            f'[Jump to message]({after.jump_url})\n'
            f'Username: {after.author.name}\n'
            f'Nickname: {after.author.display_name}\n'
            f'User @: {after.author.mention}\n'
            f'Channel: {after.channel.mention}'
        )

        embed = (
            Embed(
                title='Message Edited',
                description=description,
                color=Colour.from_str('#f5ed00'),
                timestamp=datetime.now(ZoneInfo('America/New_York')),
            )
            .add_field(
                name='Original Message',
                value="*Couldn't fetch original (Message wasn't cached)*"
                if not cached
                else (
                    before.content
                    if len(before.content) < 1024
                    else '*Message too long to display*'
                ),
                inline=False,
            )
            .add_field(name='---------', value=' ', inline=False)
            .add_field(
                name='Edited Message',
                value=after.content or "*Couldn't fetch message*"
                if len(after.content) < 1024
                else '*Message too long to display*',
                inline=False,
            )
            .set_footer(text='Time')
        )

        channel_list = get_config(ConfigOptions.CHANNELS).get('message_logs', [])

        for channel_id in channel_list:
            log_channel = self.bot.get_channel(channel_id)

            if log_channel:
                await log_channel.send(embed=embed)
            else:
                logger.error('Log channel not found, cannot log edited message')

    @logger.catch
    @commands.Cog.listener()
    async def on_message_delete(self, message):
        """
        Log deleted messages.

        This uses the cached message from Discord.
        It will ignore messages that are not cached.
        """

        # First ignore bot messages
        if message.author.bot:
            return

        description = (
            f'Username: {message.author.name}\n'
            f'Nickname: {message.author.display_name}\n'
            f'User @: {message.author.mention}\n'
            f'Channel: {message.channel.mention}'
        )

        embed = (
            Embed(
                title='Message Deleted',
                description=description,
                color=Colour.from_str('#f02828'),
                timestamp=datetime.now(ZoneInfo('America/New_York')),
            )
            .add_field(
                name='Deleted Message',
                value=message.content
                if len(message.content) < 1024
                else '*Message too long to display*',
                inline=False,
            )
            .set_footer(text='Time')
        )

        channel_list = get_config(ConfigOptions.CHANNELS).get('message_logs', [])

        for channel_id in channel_list:
            log_channel = self.bot.get_channel(channel_id)

            if log_channel:
                await log_channel.send(embed=embed)
            else:
                logger.error('Log channel not found, cannot log deleted message')
