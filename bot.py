#!/usr/bin/env python3
"""
* Wright State University eSports
* Discord Bot
* ===========================
*   Contributors:
*   @author Joshua Quaintance
* ===========================
"""

# System Imports
import os
from sys import argv
from time import perf_counter

# Library Imports
import discord
from discord.ext import commands
from dotenv import load_dotenv
from loguru import logger

# Local Imports
from utils.logger import initialize_logger, enable_cli_logging


__start_time = perf_counter()

# Initialize regular logging
initialize_logger()

# Enable CLI logging if in development mode
if os.getenv('ENVIRONMENT', 'production') == 'development' or (
    len(argv) > 1 and argv[1] == '--dev'
):
    enable_cli_logging()
    logger.warning('Running in development mode')


logger.success('Logger initialized')
logger.info('==============================')
logger.info('     WRIGHT STATE ESPORTS     ')
logger.info('          DISCORD BOT         ')
logger.info('==============================')
logger.info('Booting up...')
logger.info('Loading environment variables')
load_dotenv()

# Constants
TOKEN = os.getenv('DISCORD_TOKEN')
INTENTS = discord.Intents(
    guilds=True,
    guild_messages=True,
    guild_reactions=True,
    messages=True,
    message_content=True,
    reactions=True,
    webhooks=True,
    moderation=True,
)

__proper_wd__ = os.path.dirname(os.path.abspath(__file__))
logger.info(f'Ensuring working directory is properly set to {__proper_wd__}')
os.chdir(__proper_wd__)

logger.info('Creating bot instance')
bot = commands.Bot(command_prefix='$-', intents=INTENTS)

logger.info('Attaching event listeners')


@bot.event
async def on_ready():
    """
    Initialize the bot when it's ready.

    Loading cogs and setting initial states.
    """
    logger.success(f'Logged in as: {bot.user} <#{bot.user.id}>')
    logger.info('Running setup...')
    # ! RE ENABLE DISCORD LOGGING
    # await enable_discord_logging(bot)

    await bot.change_presence(
        activity=discord.Activity(type=discord.ActivityType.watching, name='Cogs Loading!'),
        status=discord.Status.dnd,
    )

    logger.info(logger.section)
    logger.info('Loading cogs...')

    # Load all cogs in the cogs directory
    for cog in os.listdir('./cogs'):
        if not cog.startswith('__') and cog.endswith('.py'):
            try:
                logger.info(f'Loading cog: {cog}')

                await bot.load_extension(f'cogs.{cog[:-3]}')
                logger.success(f'{cog} Loaded')

            except commands.errors.NoEntryPointError:
                logger.error(f'Cog {cog} does not have a setup function')

            except Exception as e:
                logger.error(f'Failed to load cog {cog}: {e}')

    logger.success('All cogs loaded!')
    logger.info(logger.section)
    logger.info('Updating status')

    await bot.change_presence(
        activity=discord.Activity(type=discord.ActivityType.playing, name='at WSU eSports!'),
        status=discord.Status.online,
    )

    # TODO: Add a way to notify when the bot is updated/restarted in cli and Discord even if
    # TODO: the cli and discord logger isn't enabled
    logger.success(logger.section)
    logger.success(f'{bot.user} is online and ready!')
    logger.success(logger.section)
    logger.info(f'Bootup completed in {perf_counter() - __start_time:.2f} seconds')


# Execute
if __name__ == '__main__':
    logger.info('Logging in...')
    bot.run(TOKEN)
