FROM oven/bun:latest

WORKDIR /bot

COPY . .
COPY rowdyraider.json ./

RUN bun install --production

ENV NODE_ENV=production

CMD ["bun", "run", "start"]