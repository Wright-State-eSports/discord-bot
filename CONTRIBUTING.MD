# Contributing

## Language

This Discord bot uses JavaScript as it's language

## Standards and Conventions

This repository uses [eslint](https://eslint.org/) as a linter and [prettier](https://prettier.io/) to format files consistently between different developers.

--

#### JS Style Guide

This repository also follows good JavaScript conventions from MDN web docs here: https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Code_style_guide/JavaScript

--

#### Eslint

This repository uses `eslint:recomended` preset configurations with the rules listed here:
https://eslint.org/docs/latest/rules/

There are also some additional custom rules that can be viewed inside of [eslint.config.js](eslint.config.js). Installing the VSCode extension will automatically show warnings and formatting errors.

--

#### Prettier

Prettier is also utilized for formatting. The settings can be read inside of [.prettierrc](.prettierrc). Installing the VSCode extension for Prettier will automatically attempt to format on save (if the setting is enabled)

## Dependencies

#### Pre-requisites

> [!IMPORTANT]
> There are a few required pre-requisites to have to develop the bot:
>
> - Node.js | https://nodejs.org/en
> - bun | https://bun.sh or npm (packaged with Node.js)
> - Docker | https://docs.docker.com/

Bun is preferred since it has better performance but npm works just fine because it was built using npm, but bun is npm compatible

Docker is used to containerize the bot in AWS that also helps with automation in the server side.

--

This discord bot utilizes the [discord.js](https://discordjs.dev/) to talk to the discord API.  
It runs on the latest LTS version of Node.js which is v22.15

The dependencies that are used for this repository is listed inside of [package.json](package.json) listed as dependencies. Dev dependencies are also listed in the package.json and they are dependencies used only for development.

## Developing

#### 1. Clone the repository

```sh
# ssh
git clone git@github.com:Wright-State-eSports/esports-bot
```

or

```sh
# https
git clone https://github.com/Wright-State-eSports/esports
```

--

#### 2. Install Dependencies

```sh
# bun
bun install
```

or

```sh
# npm
npm install
```

--

#### 3. Create secrets

This bot uses `dotenv` for secrets that will contain discord tokens and other sensitive informations.  
There is also a json that is required to communicate with the Google AppsScript API that can be obtained from the Google Forms that the script is attached to

Inside the `.env`, you will need the discord bot token and client id, which you can obtain yourself using your own application or if you have access to the esports bot's tokens.

--

#### 4. Create a new branch

```sh
git branch new-branch-name
```

Name the branch to correlate on what is being worked on, or just put your GitHub username if it's too generic. Then switch to the branch.

```sh
git switch new-branch-name

# or

git checkout new-branch-name
```

--

#### 5. Start developing using your preffered editor

#### 6. Commit and push changes to branch

#### 7. Create a pull request in GitHub

> [!NOTE]  
> https://github.com/Wright-State-eSports/esports-bot/pulls

--

## Server Side

This bot uses a Free Tier EC2 server that is free forever as long as you don't have any other projects.

The AWS Server also contains a websocket server that is set up to receive updates from GitHub after a new push to stop the docker container and spin up a new one with the updated code.

---

> [!WARNING]  
> TODO: Put the redeploy script and webhook setup
