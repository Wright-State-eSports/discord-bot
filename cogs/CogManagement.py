from os import listdir
from loguru import logger
from enum import StrEnum
from discord import app_commands, Interaction
from discord.ext import commands

from utils.decorators import admin


def get_cog_enums():
    """
    Dynamically create an enum of cog names from the cogs directory.
    Mostly to generate the list of cogs for the management of all cogs.

    Better than using autocomplete, which the user can still input custom
    values that don't exist, but using choices, they're restricted to the actual cogs.
    """
    __list_of_cogs__ = {}

    for cog in listdir('./cogs'):
        if cog.endswith('.py') and cog != '__init__.py':
            __name__ = cog[:-3]
            __list_of_cogs__[__name__] = __name__

    global CogNames
    CogNames = StrEnum('CogNames', __list_of_cogs__)

    return CogNames


get_cog_enums()  # We are running before the class definition to create the enum


async def setup(bot: commands.Bot):
    """Setup the CogManagement cog."""

    await bot.add_cog(CogManagement(bot))


class CogManagement(commands.Cog):
    """Cog for managing other cogs."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(description='Reload a specified cog')
    @admin
    @logger.catch
    async def reload(self, interaction: Interaction, cog_name: CogNames):
        """
        Reload a specified cog.
        """
        logger.warning(f'Reloading cog: {cog_name}')

        interaction.response.send_message('NOT IMPLEMENTED YET')

    @app_commands.command(description='Sync all slash commands')
    @admin
    @logger.catch
    async def sync(self, interaction: Interaction):
        """Syncs all slash commands
        Syncs application commands to the bot's global tree.
        Copies to current server.
        """

        await self.bot.tree.sync()  # syncs global tree to server/guilds
        await interaction.response.send_message('All slash commands have been synced')
        logger.success('Synced all slash commands')

    @commands.command(name='bootstrap', help='Initial bootstrap of slash commands')
    @commands.has_permissions(administrator=True)
    @logger.catch
    async def bootstrap(self, ctx):
        """Syncs all slash commands
        Syncs application commands to the bot's global tree.
        Copies to current server.
        """

        await self.bot.tree.sync()  # syncs global tree to server/guilds
        self.bot.tree.copy_global_to(
            guild=ctx.guild
        )  # needs to be run the first time a bot syncs to a server
        await ctx.send('Initial bootstrap complete')
