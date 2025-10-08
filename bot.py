#!/usr/bin/env python3

# Wright State University eSports
# Discord Bot
# ===========================
#   Contributors:
#   @author Joshua Quaintance
# ===========================

# System Imports
import os

# Library Imports
import discord
from discord.ext import commands
from dotenv import load_dotenv
from loguru import logger


# Set up logger
# ? Might move to a different file if it gets too much

# Add a combined file output with a rotation of 1 MB
logger.add("logs/combined.log", format="{time} | {level} | {message}", rotation="1 MB")


load_dotenv()

# Constants
TOKEN = os.getenv('DISCORD_TOKEN')
INTENTS = discord.Intents(
    guilds              = True,
    guild_messages      = True,
    guild_reactions     = True,

    messages            = True,
    message_content     = True,

    reactions           = True,
    webhooks            = True,
    moderation          = True,
)

bot = commands.Bot(command_prefix='$-', intents=INTENTS)

@bot.event
async def on_ready():
    print(f'Logged in as: {bot.user} <#{bot.user.id}>')



# Execute
if __name__ == "__main__":
    bot.run(TOKEN)

