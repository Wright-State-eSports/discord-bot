# Developer Guide

This guide covers conventions, patterns, and workflows for developing on the WSU eSports Discord Bot.

---

## Getting Started

### 1. Clone and Install

#### Clone

```bash
# using https
git clone https://github.com/wright-state-esports/discord-bot.git

# OR using SSH
git clone git@github.com:wright-state-esports/discord-bot.git
```

#### Install

```bash
cd discord-bot
bun install
```

### 2. Set Up Environment

Copy `.env.development` and fill in your own values:

```bash
cp .env.development .env.development.local
```

| Variable        | Where to get it                                                            |
| :-------------- | :------------------------------------------------------------------------- |
| `DISCORD_TOKEN` | Discord Developer Portal → Your App → Bot → Token                          |
| `CLIENT_ID`     | Discord Developer Portal → Your App → General Information → Application ID |
| `GUILD_ID`      | Right-click your Discord server → Copy Server ID (enable Dev Mode first)   |
| `SCRIPT_LINK`   | Google Apps Script web app deployment URL (optional)                       |

### 3. Set Up `config.dev.json`

Create `config.dev.json` at the project root:

```json
{
  "webhooks": {
    "logs": {
      "id": "<logs-webhook-id>"
    },
    "new-register": {
      "id": "<new-register-webhook-id>",
      "channel-id": "<registration-channel-id>",
      "startup-sweep-message-limit": 25
    },
    "message-log": {
      "name": "Message Logs"
    }
  },
  "roles": {
    "raider": "<raider-role-id>",
    "guest": "<guest-role-id>",
    "not-signed-up": "<not-signed-up-role-id>"
  },
  "channels": {
    "help": "<help-channel-id>",
    "message-log": "<message-log-channel-id>"
  }
}
```

#### Configuration Key Reference

##### `webhooks`

| Key                                        | Path                                                | Type     | Description                                                                   |
| :----------------------------------------- | :-------------------------------------------------- | :------- | :---------------------------------------------------------------------------- |
| `logs.id`                                  | `webhooks.logs.id`                                  | `string` | Webhook ID for in-Discord logging channel                                     |
| `new-register.id`                          | `webhooks.new-register.id`                          | `string` | Webhook ID for incoming registration webhook messages                         |
| `new-register.channel-id`                  | `webhooks.new-register.channel-id`                  | `string` | Channel ID where the registration webhook posts                               |
| `new-register.startup-sweep-message-limit` | `webhooks.new-register.startup-sweep-message-limit` | `number` | Max messages to sweep on startup for unprocessed registrations (default `25`) |
| `message-log.name`                         | `webhooks.message-log.name`                         | `string` | Name for the auto-provisioned message log webhook (default `Message Logs`)    |

##### `roles`

| Key             | Path                  | Type     | Description                                 |
| :-------------- | :-------------------- | :------- | :------------------------------------------ |
| `raider`        | `roles.raider`        | `string` | Role ID for full members (Raiders)          |
| `guest`         | `roles.guest`         | `string` | Role ID for guests                          |
| `not-signed-up` | `roles.not-signed-up` | `string` | Role ID for users who haven't signed up yet |

##### `channels`

| Key           | Path                   | Type     | Description                                                                     |
| :------------ | :--------------------- | :------- | :------------------------------------------------------------------------------ |
| `help`        | `channels.help`        | `string` | Channel ID where help/approval notifications (`<@user>, you are set!`) are sent |
| `message-log` | `channels.message-log` | `string` | Channel ID where edited and deleted message audit logs are sent via webhook     |

### 4. Run

```bash
bun run dev
```

---

## Code Conventions

### File Naming & Grouping

- All source files use **kebab-case**: `new-register.ts`, `button-interaction.ts`.
- **Grouping Rule**: Whenever there are **2 or more related events, commands, or utilities**, place them inside their own dedicated directory (e.g. `src/events/message/`, `src/events/button/`, `src/utils/command/`, `src/utils/config/`, `src/utils/member/`).
- Command filenames **must exactly match** their `data.name` field. The `CommandRegistry` enforces this at load time and scans subdirectories recursively.
- Event handler filenames or export names **must match** their `name` field. `EventRegistry` enforces this and scans subdirectories recursively.

### Exports

- Each command and event handler default-exports a single object.
- Use `satisfies` (not `as`) to get both type-checking and inference:

  ```typescript
  // ✅ Correct — satisfies checks the shape but preserves the exact inferred type
  export default {
    name: 'my-event',
    event: Events.MessageCreate,
    execute: async (message) => { ... },
  } satisfies EventHandler<Events.MessageCreate>;

  // ❌ Avoid — as casts away type errors
  export default { ... } as EventHandler<Events.MessageCreate>;
  ```

- **`export default` always comes immediately after imports.** The goal is to prevent clutter between the imports and the export — opening a file should immediately show you what it exports without scrolling past helper functions or large constant blocks. Helpers go below; the only exception is important constants that are brief and genuinely clarify the export itself (e.g. a regex or a small shared value).

  ```typescript
  // ✅ Correct — important constant above, helpers below
  import { ... } from '...';

  const MESSAGE_URL_REGEX = /https:\/\/.../; // meaningful to see up top

  export default {
    data: ...,
    async execute(interaction) {
      const match = MESSAGE_URL_REGEX.exec(...);
      doSomething();
    },
  } satisfies ChatInputCommand;

  // ─── helpers below ───────────────────────────────────────────────
  function doSomething() { ... }
  ```

  ```typescript
  // ❌ Wrong — export default buried at the bottom
  import { ... } from '...';

  function doSomething() { ... }

  export default { ... } satisfies ChatInputCommand;
  ```

- Utilities are barrel-exported from `src/utils/index.ts`. Any new utility file in `src/utils/` should be added there.

### Imports

- Import from `../utils` (the barrel) rather than deep-pathing into individual utility files, except inside `src/utils/` itself where relative imports are fine.

  ```typescript
  // ✅ In src/events/ or src/commands/
  import { AppLogger, Config, ConfigKeys } from '../utils';

  // ✅ Inside src/utils/
  import { AppLogger } from './logger';
  ```

---

## Working with Config

All configuration keys live in [`src/utils/config/keys.ts`](src/utils/config/keys.ts). This is the single source of truth.

### Reading a value

```typescript
import { Config, ConfigKeys } from '../utils';

const roleId = await Config.get(ConfigKeys.Roles.Raider);
```

`Config.get` returns `undefined` if the key is not found in the config file. Always handle this case:

```typescript
const roleId = (await Config.get(ConfigKeys.Roles.Raider)) ?? 'fallback-id';
```

````

### Adding a new config key

1. Open `src/utils/config/keys.ts`.
2. Add the key to the appropriate `key()` group or create a new one:

   ```typescript
   // Adding a new key under an existing group:
   Roles: key('roles', {
     Raider: key('raider'),
     Guest: key('guest'),
     NotSignedUp: key('not-signed-up'),
     Moderator: key('moderator'), // ← new
   }),
````

3. Add the corresponding entry to `config.dev.json` and `config.json`:

   ```json
   "roles": {
     "moderator": "<mod-role-id>"
   }
   ```

4. Use it: `await Config.get(ConfigKeys.Roles.Moderator)`

> ⚠️ **Every `ConfigKey` is required.** Document what happens when a key is missing in your feature code.

---

## Logging

### Using `AppLogger`

```typescript
import { AppLogger } from '../utils';

// Scope is shown in the log breadcrumbs. Use meaningful, hierarchical names.
const logger = new AppLogger('events');
// or: const logger = AppLogger.get('events'); // singleton per scope

// Child loggers add to the breadcrumb trail
const childLogger = logger.child('my-feature');
// or: logger.child(['my-feature', 'sub-operation']);

// Log levels
childLogger.trace('Very verbose internal info');
childLogger.debug('Useful for debugging');
childLogger.info('Normal operational info');
childLogger.warn('Something unexpected but recoverable');
childLogger.error(error, 'Something failed'); // pass error as first arg
```

### Using `DiscordLogger`

Only use `DiscordLogger` for significant events worth surfacing to server admins. Spam will make the log channel useless.

```typescript
import { DiscordLogger, AppLogger } from '../utils';

const logger = AppLogger.get('my-feature');

// Send a rich embed (silent by default - does not ping or trigger sound/badge)
await DiscordLogger.embed(logger.error, 'Something broke', {
  error: err,
  options: { title: 'Error Title', color: 0xff0000 },
});

// To intentionally ping / notify channel members on critical events:
await DiscordLogger.embed(logger.fatal, 'Critical database failure!', {
  error: err,
  quiet: false,
});

// Send a plain text message (silent by default)
await DiscordLogger.log(logger.info, 'Bot restarted successfully');
```

---

## Adding a Slash Command

1. Create `src/commands/<your-command>.ts`:

   ```typescript
   import { SlashCommandBuilder } from 'discord.js';

   export default {
     data: new SlashCommandBuilder()
       .setName('your-command') // Must match filename 'your-command.ts'
       .setDescription('What it does.')
       .addStringOption((o) => o.setName('input').setDescription('Some input').setRequired(true)),

     async execute(interaction) {
       const input = interaction.options.getString('input', true);
       await interaction.reply(`You said: ${input}`);
     },

     // Optional: add autocomplete support
     async autocomplete(interaction) {
       await interaction.respond([{ name: 'Example', value: 'example' }]);
     },
   } satisfies ChatInputCommand;
   ```

2. Register the command with Discord:

   ```bash
   bun run register
   ```

> 💡 Commands are registered per-guild (to `GUILD_ID`). Changes take effect immediately for guild commands, unlike global commands which can take up to an hour.

---

## Adding a Context Menu Command

1. Create `src/context-menus/<your-menu>.ts`:

   ```typescript
   import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js';

   export default {
     data: new ContextMenuCommandBuilder().setName('My Context Action').setType(ApplicationCommandType.Message), // or .User

     async execute(interaction) {
       // For Message type:
       // const target = interaction.targetMessage;
       await interaction.reply({ content: 'Action taken!', ephemeral: true });
     },
   } satisfies MessageContextMenuCommand;
   ```

2. Register: `bun run register`

---

## Adding an Event Handler

1. Create `src/events/<event-name>.ts`:

   ```typescript
   import { Events } from 'discord.js';

   export default {
     name: 'event-name', // Must match filename 'event-name.ts'
     event: Events.GuildMemberAdd,
     execute: async (member) => {
       // handle the event
     },
   } satisfies EventHandler<Events.GuildMemberAdd>;
   ```

---

## Adding a Button Handler

1. Create `src/events/button/<button-action>.ts`:

   ```typescript
   import type { ButtonInteraction } from 'discord.js';

   export async function handleMyButton(interaction: ButtonInteraction): Promise<void> {
     // handle button action
   }
   ```

2. Add the `customId` switch case and export to [`src/events/button/index.ts`](src/events/button/index.ts).

The `EventRegistry` automatically discovers and loads both flat files (`src/events/<name>.ts`) and directory modules (`src/events/<name>/index.ts`) on startup. No manual registration needed.

---

## Hot-Reloading Commands (Runtime)

The `/commands` slash command (admin-only) lets you reload, load, and unload commands without restarting the bot:

```
/commands reload <command>    — Reload a specific command from disk
/commands load <command>      — Load a previously unloaded command
/commands unload <command>    — Unload a command (it stays registered with Discord but won't execute)
/commands list                — List all loaded commands
/commands update              — Push current commands to Discord API
```

---

## TypeScript Notes

### Global Types

Global types (`Command`, `EventHandler`, `Client`, `SubcommandHandler`, etc.) are declared in `src/global.d.ts` and are available everywhere without importing.

### `satisfies` vs `as`

Always prefer `satisfies` for command and event handler exports. It enforces the shape while preserving the exact inferred type of the object — meaning `data.name` retains its literal string type, and typos in property names are caught at compile time.

### Config Types

`ConfigKey` is the TypeScript union type of all valid config path strings:

```typescript
type ConfigKey = 'webhooks.logs.id' | 'roles.raider' | 'channels.help' | ...
```

`Config.get` and `Config.set` both accept `ConfigKey`. Passing a string literal that isn't in `ConfigKeys` will cause a compile error.

---

## Common Pitfalls

| Problem                           | Fix                                                                                     |
| :-------------------------------- | :-------------------------------------------------------------------------------------- |
| Command not showing up in Discord | Run `bun run register` after adding/renaming                                            |
| Command ignored at runtime        | Check that `data.name` matches the filename                                             |
| Event handler not firing          | Check that `name` matches the filename                                                  |
| Config value is `undefined`       | Check the key exists in `config.dev.json` and the path matches `ConfigKeys`             |
| `DiscordLogger` not sending       | Verify `channels.logs` is configured and the bot has permissions in that channel        |
| Registration sweep not running    | Ensure `webhooks.new-register.id` and `webhooks.new-register.channel-id` are configured |
