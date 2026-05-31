#!/bin/sh

# Mark /bot as safe for git to prevent dubious ownership issues
git config --global --add safe.directory /bot

# Check if .git exists, if not initialize it
if [ ! -d .git ]; then
  echo "No .git directory found. Initializing git repository..."
  git init
  git remote add origin https://github.com/Wright-State-eSports/discord-bot.git
  echo "Fetching main branch..."
  if git fetch origin main; then
    # Force checkout the main branch from origin
    git checkout -f -B main origin/main
    echo "Git repository initialized and synchronized successfully."
  else
    echo "Warning: Failed to fetch from remote repository. Starting with existing local files..."
  fi
else
  # Pull the latest changes
  echo "Checking for updates..."
  if git pull; then
    echo "Git pull completed successfully."
  else
    echo "Warning: Git pull failed. Starting application with existing local files..."
  fi
fi

# Install updated dependencies if package.json has changed
echo "Installing/verifying dependencies..."
if bun install --production; then
  echo "Dependencies verified/installed successfully."
else
  echo "Warning: Dependency installation failed. Proceeding..."
fi

# Start the application
echo "Starting application..."
exec bun run start
