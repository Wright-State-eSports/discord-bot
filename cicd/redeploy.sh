#!/bin/bash

# Stop a possible previous instance that's running
sudo singularity instance stop prod-bot

cd esports-bot
rm -f bun.lock
rm -f package-lock.json
git pull

# If the current git commit has the string "nodeenv.def" in it,
# That means we need to rebuild the container because the 
# definition file has been changed
if git show --name-status HEAD | grep -q "nodeenv.def"; then
    echo "Definition file changed, rebuilding container..."

    # Backup the old container
    mv env.sif env.sif.prev

    # Build the new container
    sudo singularity build env.sif nodenv.def

    echo "Container rebuilt"
fi

# then start a new one that has a start script
# that starts the bot
sudo singularity instance start env.sif prod-bot


