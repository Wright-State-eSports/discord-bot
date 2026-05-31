FROM oven/bun:latest

# Install git
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /bot

COPY . .
COPY rowdyraider.json ./

RUN bun install --production

ENV NODE_ENV=production

# Set up entrypoint script
RUN chmod +x entrypoint.sh
ENTRYPOINT ["/bot/entrypoint.sh"]