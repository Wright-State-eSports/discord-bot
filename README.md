# Wright State University eSports Discord Bot

A general-purpose Discord bot for the Wright State University eSports server. Built with [Bun](https://bun.sh), [TypeScript](https://www.typescriptlang.org), and [discord.js](https://discord.js.org).

---

## Features

- **Member Sign-Up Pipeline** — Intercepts registration webhooks from a Google Script, enriches them with Discord member info, and surfaces one-click approval buttons.
- **Auto-Role** — Assigns Raider, Guest, or Not-Signed-Up roles when staff approve members via button interactions.
- **Google Sheets Integration** — Notifies a Google Apps Script endpoint on member approval or cancellation.
- **In-Discord Logging** — Streams structured log output to a Discord webhook channel via `DiscordLogger`.
- **Hot-Reloadable Commands** — Load, unload, and reload slash commands at runtime without restarting the bot.
- **Startup Sweep** — On boot, scans the registration channel for unprocessed webhook messages and processes them.
- **Message Editing** — Context menu + slash command workflow for staff to edit any bot-authored message in place.
- **Persistent Configuration** — Runtime configuration stored in `config.json`, readable and writable without restarts.

---

## Prerequisites

| Tool                          | Version                 |
| :---------------------------- | :---------------------- |
| [Bun](https://bun.sh)         | `1.3.14`                |
| [Node.js](https://nodejs.org) | n/a (Bun replaces Node) |

---

## Quick Start

```bash
# Install dependencies
bun install

# Run in development mode (uses config.dev.json and pretty logs)
bun run dev

# Run in production
bun run start
```

---

## Scripts

| Script                        | Description                                                    |
| :---------------------------- | :------------------------------------------------------------- |
| `bun run dev`                 | Starts the bot in development mode (`NODE_ENV=development`)    |
| `bun run dev:watch`           | Starts with `--watch` for automatic restarts on file changes   |
| `bun run start`               | Starts the bot in production                                   |
| `bun run register`            | Registers all slash/context-menu commands with the Discord API |
| `bun run unregister-commands` | Unregisters all commands from the Discord API                  |

---

## Environment Variables

Create a `.env` file (or `.env.development` for dev) at the project root:

| Variable               | Required | Description                                            |
| :--------------------- | :------: | :----------------------------------------------------- |
| `DISCORD_TOKEN`        |    ✅    | Discord bot token                                      |
| `CLIENT_ID`            |    ✅    | Discord application client ID                          |
| `GUILD_ID`             |    ✅    | Discord guild (server) ID                              |
| `LOGGER_WEBHOOK_TOKEN` |    ✅    | Webhook token for the in-Discord logger channel        |
| `SCRIPT_LINK`          |    ⬜    | Google Apps Script endpoint URL for Google Sheets sync |

---

## Configuration

The bot uses a JSON configuration file (`config.json` in production, `config.dev.json` in development) for settings that can change at runtime. All configuration keys are defined in [`src/utils/config-keys.ts`](src/utils/config-keys.ts).

### Schema Overview

```json
{
  "webhooks": {
    "logs": {
      "id": "string"
    },
    "new-register": {
      "id": "string",
      "channel-id": "string",
      "startup-sweep-message-limit": 25
    }
  },
  "roles": {
    "raider": "string",
    "guest": "string",
    "not-signed-up": "string"
  },
  "channels": {
    "help": "string"
  }
}
```

### Hierarchy Reference

#### `webhooks`

| Key                                        | Path                                                | Type     | Description                                                                   |
| :----------------------------------------- | :-------------------------------------------------- | :------- | :---------------------------------------------------------------------------- |
| `logs.id`                                  | `webhooks.logs.id`                                  | `string` | Webhook ID for in-Discord logging channel                                     |
| `new-register.id`                          | `webhooks.new-register.id`                          | `string` | Webhook ID for incoming registration webhook messages                         |
| `new-register.channel-id`                  | `webhooks.new-register.channel-id`                  | `string` | Channel ID where the registration webhook posts                               |
| `new-register.startup-sweep-message-limit` | `webhooks.new-register.startup-sweep-message-limit` | `number` | Max messages to sweep on startup for unprocessed registrations (default `25`) |

#### `roles`

| Key             | Path                  | Type     | Description                                 |
| :-------------- | :-------------------- | :------- | :------------------------------------------ |
| `raider`        | `roles.raider`        | `string` | Role ID for full members (Raiders)          |
| `guest`         | `roles.guest`         | `string` | Role ID for guests                          |
| `not-signed-up` | `roles.not-signed-up` | `string` | Role ID for users who haven't signed up yet |

#### `channels`

| Key    | Path            | Type     | Description                                                                     |
| :----- | :-------------- | :------- | :------------------------------------------------------------------------------ |
| `help` | `channels.help` | `string` | Channel ID where help/approval notifications (`<@user>, you are set!`) are sent |

---

## Project Structure

```
src/
├── main.ts               # Entry point — client setup, event wiring, startup logic
├── global.d.ts           # Global TypeScript types (Command, EventHandler, etc.)
│
├── commands/             # Slash commands (one file per command)
│   ├── commands.ts       # /commands — load/unload/reload/list commands at runtime
│   ├── edit-message.ts   # /edit-message — edit a previously selected bot message
│   ├── ping.ts           # /ping — basic latency check
│   ├── say.ts            # /say — send or schedule a message as the bot
│   └── setup-signup.ts   # /setup-signup — deploy the member sign-up onboarding message
│
├── context-menus/        # Right-click context menu commands
│   └── select-message.ts # "Select Message to Edit" — marks a message for /edit-message
│
├── events/               # Discord event handlers (one file per handler)
│   ├── autocomplete.ts          # Handles autocomplete interactions
│   ├── button-interaction.ts    # Handles approval/cancellation button clicks
│   ├── chat-input-command.ts    # Routes slash command interactions to CommandRegistry
│   ├── context-menu-command.ts  # Routes context menu interactions to CommandRegistry
│   └── new-register.ts          # Processes Google Script registration webhooks
│
└── utils/                # Shared utilities and infrastructure
    ├── index.ts           # Barrel file — re-exports all utils
    ├── config-keys.ts     # Config key definitions (source of truth for config.json paths)
    ├── config.ts          # Config class — loads, reads, and writes config.json
    ├── command-registry.ts # Loads, unloads, and stores slash/context-menu commands
    ├── event-registry.ts   # Loads and stores event handlers
    ├── registry.ts         # Abstract base class for registries
    ├── logger.ts           # AppLogger (pino wrapper) + DiscordLogger (webhook sink)
    ├── member/             # Member role & lookup helpers (hasRaiderRole, promoteToRaider, findGuildMember, etc.)
    ├── message/            # Message utilities & MessageSelection TTL cache for edit workflow
    ├── registration/       # Registration card parsing & notification helpers (extractUserIdFromCard, etc.)
    ├── register-commands.ts # Script to register commands with the Discord API
    ├── unregister-commands.ts # Script to unregister all commands
    └── utils.ts            # General-purpose helpers (debounce, userCombo)
```

---

## Adding a Command

1. Create a new file in `src/commands/` named exactly `<command-name>.ts` (kebab-case).
2. Default-export an object satisfying the `ChatInputCommand` global interface.
3. The command `data.name` **must match** the filename without extension — the loader will skip mismatches.

```typescript
// src/commands/my-command.ts
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('my-command').setDescription('Does something cool.'),

  async execute(interaction) {
    await interaction.reply('Hello!');
  },
} satisfies ChatInputCommand;
```

4. Register the command with Discord: `bun run register`

---

## Adding an Event Handler

1. Create a new file in `src/events/` named exactly `<event-name>.ts` (kebab-case).
2. Default-export an object satisfying the `EventHandler<K>` global interface.
3. The `name` field **must match** the filename without extension.

```typescript
// src/events/my-event.ts
import { Events } from 'discord.js';

export default {
  name: 'my-event',
  event: Events.MessageCreate,
  execute: async (message) => {
    // handle the event
  },
} satisfies EventHandler<Events.MessageCreate>;
```

---

## Contributors

- **Joshua Quaintance** — Lead developer
