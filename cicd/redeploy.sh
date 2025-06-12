#!/bin/bash

# Stop a possible previous instance that's running
sudo singularity instance stop prod-bot

cd esports-bot
git pull

# then start a new one that has a start script
# that starts the bot
sudo singularity instance start env.sif prod-bot
