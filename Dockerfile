FROM node:lts

# Create a workdir
RUN mkdir -p /usr/src/bot

WORKDIR /usr/src/bot

# Copy and install packages
COPY package.json /usr/src/bot
COPY package-lock.json /usr/src/bot

RUN npm ci

COPY . /usr/src/bot

# ======
ENV NODE_ENV=production

RUN chown -R node /usr/src/bot/data
RUN chown -R node /usr/src/bot/commands
RUN chown -R node /usr/src/bot/interactions
RUN chown -R node /usr/src/bot/logs
RUN chown -R node /usr/src/bot/utils
RUN chown node /usr/src/bot/accessToken.js
RUN chown node /usr/src/bot/index.js
RUN chown node /usr/src/bot/typedefs.js
RUN chown node /usr/src/bot/rowdyraider.json

CMD ["npm", "run", "start"]
# CMD ["ls", "-lah"]
