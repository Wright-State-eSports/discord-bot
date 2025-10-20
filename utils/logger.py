"""
Logger setup using Loguru

This file contains all the configuration setup for the logger
this includes intercepting the standard discord.py logging to
use loguru instead for standardization.
The goal is to make one logger config and to not need to touch
it again unless it is a critical change.

- initialize_logger() - Call this once to set up the logger
- enable_cli_logging() - Call this to add CLI logging output
"""

# System Imports
import logging
from os import getenv
from sys import stdout
from itertools import chain

# Library Imports
from loguru import logger
from discord.ext.commands import Bot
from dotenv import load_dotenv

load_dotenv()
LOG_CHANNEL_ID = getenv('LOG_CHANNEL_ID')


def initialize_logger():
    """
    Initialize the logger configuration.
    Call before any logging is needed.
    """
    setup_intercept()
    logger.remove()  # Remove the default stderr config

    logger.section = '==========================='  # Custom attribute for sections

    # Logs info and success
    logger.add(
        'logs/info.log',
        format='{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name: <16} | {message}',
        level='INFO',
        enqueue=True,
        rotation='00:00',  # Rotate at midnight
        retention='3 days',
        filter=lambda record: record['level'].name == 'INFO' or record['level'].name == 'SUCCESS',
    )

    logger.add(
        'logs/errors.log',
        format='{time:YYYY-MM-DD HH:mm:ss} | {name: <16} | {message}',
        level='ERROR',
        backtrace=True,
        diagnose=True,
        enqueue=True,
        rotation='00:00',  # Rotate at midnight
        retention='3 days',
    )

    # Combined log file
    logger.add(
        'logs/combined.log',
        format='{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name: <16} | {message}',
        enqueue=True,
        rotation='00:00',  # Rotate at midnight
        compression='zip',  # Compress rotated files
    )


async def enable_discord_logging(bot: Bot):
    """
    Enable logging to a Discord channel.
    Call if you want to send logs to a specific Discord channel.
    """

    # First attach the bot instance to the logger for access in the sink
    logger.info('Enabling Discord logging, attaching bot instance...')
    logger.__discord = type('obj', (object,), {})()  # Create a simple empty object
    logger.__discord.bot = bot
    logger.__discord.channel = bot.get_channel(int(LOG_CHANNEL_ID)) if LOG_CHANNEL_ID else None

    logger.info('Adding Discord log sink...')
    logger.add(
        discord_log_sink,
        format='{message}',
        enqueue=True,
        filter=lambda record: 'rate limited' not in record['message'],  # Ignore rate limited logs
    )
    logger.success('Discord logging enabled!')


async def discord_log_sink(message):
    """
    Custom sink function that will also send all these logs into a discord channel.
    """

    level = message.record['level'].name
    content = message.record['message']
    if content == logger.section:
        return

    if logger.__discord.bot:
        bot: Bot = logger.__discord.bot
        channel = logger.__discord.channel

        if channel:
            await channel.send(f'` {level: <8} `  {content}')
            await logger.complete()
        else:
            print('Log channel not found, cannot send Discord logs.')
    else:
        logger.remove(discord_log_sink)
        logger.warning('Bot instance not attached to logger, cannot send Discord logs.')
        logger.warning('Removing sink')


def enable_cli_logging():
    """
    Enable logging to the command line interface (stdout).
    Call if terminal logging is desired (maybe for debugging).
    """

    logger.add(
        stdout,
        colorize=True,
        format='<green>{time:YYYY-MM-DD HH:mm:ss}</green> | '
        + '<level>{level: <8}</level> | '
        + '<magenta>{name: <16}</magenta> | '
        + '<level>{message}</level>',
        enqueue=True,
    )


def setup_intercept():
    """
    Set up interception of standard logging to redirect to loguru.
    Call if you want to capture standard logging (e.g., from discord.py).
    This will intercept logs from discord.py itself since they have
    their own logging setup.
    """
    modules = (
        'discord',
        'discord.gateway',
        'discord.http',
        'discord.state',
        'discord.client',
        'discord.ext.commands',
    )

    for name in chain(('',), modules):
        mod = logging.getLogger(name)
        mod.handlers = [InterceptHandler()]
        mod.propagate = False


class InterceptHandler(logging.Handler):
    """
    Custom logging handler to intercept standard logging and redirect to loguru.
    """

    def emit(self, record):
        # Get corresponding Loguru level if it exists
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = logging.currentframe(), 0
        while frame:
            filename = frame.f_code.co_filename
            is_logging = filename == logging.__file__
            is_frozen = 'importlib' in filename and '_bootstrap' in filename
            if depth > 0 and not (is_logging or is_frozen):
                break
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())
