# Architecture

This document describes the structural design and key patterns used in the WSU eSports Discord Bot.

---

## Overview

The bot is a single-process TypeScript application running on Bun. It connects to the Discord gateway via discord.js and reacts to events through a registry-based handler system.

```
Discord Gateway
      │
      ▼
  discord.js Client
      │
      ├── Events ─────────────────► EventRegistry ──► Event Handlers (src/events/)
      │
      └── Interactions ────────────► CommandRegistry ──► Commands (src/commands/)
                                                      ──► Context Menus (src/context-menus/)
```

---

## Entry Point: `src/main.ts`

The entry point is fully sequential — nothing is registered until its prerequisite is ready:

```
1. Config.init()           — Load config.json from disk
2. DiscordLogger.init()    — Initialize the in-Discord webhook log sink
3. Client setup            — Create the discord.js Client with intents/partials
4. CommandRegistry.initialize() — Scan and load all commands from src/commands/ and src/context-menus/
5. EventRegistry.initialize()   — Scan and load all event handlers from src/events/
6. client.on(event, handler)    — Wire all loaded event handlers to the client
7. client.login()          — Connect to the Discord gateway
8. ClientReady handler     — Log startup metrics and run the startup sweep
```

---

## Registry Pattern

Both commands and events use a shared abstract `AbstractRegistry<T>` base class (`src/structures/AbstractRegistry.ts`), which extends discord.js's `Collection<string, T>` (a typed `Map`).

```
AbstractRegistry<T> (extends Collection<string, T>)
│
├── CommandRegistryClass extends AbstractRegistry<Command>
└── EventRegistryClass extends AbstractRegistry<EventHandler<K>>
```

Each registry tracks three sets:

- **`_seen`** — all names that have ever been attempted (prevents duplicate loads)
- **`_unloaded`** — names explicitly unloaded at runtime (tracked for autocomplete)
- The `Collection` itself — all currently active entries

### Lifecycle

```
loadAll() ──► load(name) ──► validates ──► set(name, handler)
                                  └── validates name === filename
                                  └── validates required properties
                                  └── on failure: marks _seen.delete, returns false
```

```
unload(name) ──► delete(name) ──► _unloaded.add(name)
```

---

## Command System

### File Convention

Each command lives in `src/commands/<name>.ts` (slash) or `src/context-menus/<name>.ts` (context menu). The `data.name` field **must match** the filename (without `.ts`). The `CommandRegistryClass` enforces this at load time and skips mismatches.

### Types (`src/global.d.ts`)

```typescript
interface ChatInputCommand {
  data: SlashCommandBuilder | ...;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

interface MessageContextMenuCommand {
  data: ContextMenuCommandBuilder;
  execute: (interaction: MessageContextMenuCommandInteraction) => Promise<void>;
}

type Command = ChatInputCommand | ContextMenuCommand;
```

### Registration

Running `bun run register` (`src/utils/command/register.ts`) uses the Discord REST API to push all currently loaded commands as guild commands to `GUILD_ID`.

---

## Event System

Each event handler in `src/events/` default-exports an object satisfying `EventHandler<K>`:

```typescript
interface EventHandler<K extends keyof ClientEvents> {
  name: string; // Must match filename
  event: K; // The discord.js ClientEvents key to listen on
  once?: boolean;
  execute: (...args: ClientEvents[K]) => Promise<void>;
}
```

Multiple handlers can listen to the same event (e.g. both `button-interaction.ts` and `chat-input-command.ts` listen on `InteractionCreate`).

---

## Configuration System

### Storage

Configuration is stored in `config.json` (production) or `config.dev.json` (development) as a plain JSON object at the project root. The active file is selected by `NODE_ENV`.

### `Config` class (`src/utils/config/config.ts`)

A static class providing static read access and startup validation for configuration:

| Method              | Description                                                                              |
| :------------------ | :--------------------------------------------------------------------------------------- |
| `Config.init()`     | Loads the active configuration file into memory and validates all required keys          |
| `Config.get(key)`   | Reads a dot-separated key path from the in-memory config                                 |
| `Config.validate()` | Verifies that all required keys from `ConfigKeys` are defined and logs any missing paths |

### `ConfigKeys` (`src/utils/config/keys.ts`)

A statically typed object tree mapping human-readable property paths to their dot-separated JSON key equivalents. This is the **single source of truth** for all config paths.

```typescript
Config.get(ConfigKeys.Roles.Raider);
// ConfigKeys.Roles.Raider === 'roles.raider' at runtime
// TypeScript infers the exact literal type 'roles.raider'
```

The `key()` builder function constructs the paths at module load time using recursive prefixing:

```typescript
Roles: key('roles', {
  Raider: key('raider'), // → 'roles.raider'
  Guest: key('guest'), // → 'roles.guest'
  NotSignedUp: key('not-signed-up'), // → 'roles.not-signed-up'
});
```

---

## Logging

Two logger primitives exist, both exported from `src/utils/logger.ts`:

### `AppLogger` (Console + File)

A wrapper around [pino](https://github.com/pinojs/pino) that supports scoped/breadcrumb logging:

```typescript
const logger = new AppLogger('discord');
// or:
const logger = AppLogger.get('discord'); // returns a shared singleton for that scope

const childLogger = logger.child('my-command'); // adds 'my-command' to the breadcrumb
```

Outputs to:

- **Console** (pretty-printed with `pino-pretty`, `debug` level; development only)
- **`app.log`** (`info` level and above; stored in `/home/runner/logs` in production, `<cwd>/logs` in development)
- **`error.log`** (`error` level and above; stored in `/home/runner/logs` in production, `<cwd>/logs` in development)

### `DiscordLogger` (Automated Webhook Sink)

Streams notable events to the designated log channel (`channels.logs`). Dynamically searches for or provisions a bot-owned webhook (`webhooks.logs.name`, default: `"Bot Logs"`) without requiring manual secret tokens in `.env`. Automatically cleans up old webhooks on channel migration and falls back to direct `channel.send()` if webhook permissions are unavailable.

```typescript
await DiscordLogger.embed(logger.warn, 'Something notable happened', {
  options: { title: 'Alert', color: 0xff9900 },
});

await DiscordLogger.log(logger.info, 'Bot is starting up');
```

---

## Member Registration Pipeline

The member registration pipeline handles sign-ups from Google Forms/Sheets. The bot intercepts incoming registration webhooks, looks up the Discord member (with fuzzy fallback via `fuse.js`), and surfaces interactive approval cards.

```
Google Apps Script
        │ (POST webhook to Discord channel)
        ▼
Discord channel message (raw embed, no buttons)
        │
        ▼
new-register.ts: processRegistrationWebhook()
        │
        ├── Verify webhook ID / context
        ├── Parse embed fields (Name, Discord Username, Email, Register As, Sheet Row)
        ├── Query guild members with strict lookup & Fuse.js similarity scoring
        │     ├── Exact Match (>=95% score) ──► Builds matched card with Approve/Engage/Change buttons
        │     └── Unmatched (<95% score)    ──► Builds suggestion card with Top 5 dropdown & User Picker
        ├── Post enriched card from the bot client
        └── Delete raw incoming webhook message
```

### Context Menu Safeguards

The **Enrich Registration** context menu command (`src/context-menus/enrich-registration.ts`) allows admins to manually parse and enrich registration messages if an incoming webhook arrives unhandled. It incorporates `isMessageAlreadyEnriched` checks to prevent duplicate cards or re-enrichment.

### Startup Sweep

On `ClientReady`, `sweepUnprocessedRegistrations()` scans recent messages in the registration channel and processes any incoming webhook messages that arrived while the bot was offline.

---

## Announcement Studio & Message Editing

The bot provides two dedicated workflows for publishing and revising bot-sent messages:

### 1. Announcement Studio (`/announce` & `/edit-announcement`)

A private in-chat staging environment designed for long-form announcements with rich markdown and pings:

```
/announce [channel]  OR  /edit-announcement [message] [channel]
        │
        ▼
Private Thread Created (invitable: false, scoped to invoking admin)
        │
        ├── Initial Guide & Gotchas Embed (Change Destination & Cancel buttons)
        ├── (If Edit Mode) Standalone Raw Markdown Code Block with native Discord "Copy" button
        │
        ▼
Admin types draft directly in chat (supports # headers, lists, emojis, @mentions, attachments)
        │
        ▼
Bot attaches Send / Update Action Bar below the message:
        ├── [🚀 Send Announcement]   ──► Posts raw formatted message to target channel with live pings
        ├── [🔄 Update Announcement] ──► Updates existing message in target channel
        └── [❌ Cancel & Delete]     ──► Cleans up the private staging thread
```

### 2. Quick Edit (`/quick-edit`)

For rapid, single-command inline edits of bot-sent text and attachments without opening a thread:

```
1. Right-click bot message → Apps → "Select Message to Edit"
   └── context-menus/select-message.ts → MessageSelection.set(userId, { messageId, channelId })

2. /quick-edit content: "Updated text"
   └── commands/quick-edit.ts → MessageSelection.get(userId) → message.edit()
```

---

## Dependency Graph

```
main.ts
  ├── utils/ (AppLogger, DiscordLogger, Config, CommandRegistry, EventRegistry, MessageSelection, studioThreads, lookup)
  │
  ├── events/
  │   ├── new-register.ts                 ── uses Config, ConfigKeys, enrichRegistrationMessage
  │   ├── button/index.ts                 ── routes button interactions (approve, engage, studio, retry, change-user)
  │   ├── select-menu/index.ts            ── routes select menus (registration-user, studio-destination)
  │   ├── message/
  │   │   ├── announce-studio.ts          ── listens for in-thread drafts, provides Send/Update action buttons
  │   │   ├── delete.ts                   ── audit logs message deletions to message-log webhook
  │   │   └── update.ts                   ── audit logs message edits to message-log webhook
  │   ├── chat-input-command.ts           ── routes slash command execution
  │   ├── context-menu-command.ts         ── routes context menu execution
  │   └── autocomplete.ts                 ── handles slash command autocomplete
  │
  └── commands/
      ├── announce.ts                     ── opens Announcement Studio in creation mode
      ├── edit-announcement.ts            ── opens Announcement Studio in edit mode with raw copyable block
      ├── quick-edit.ts                   ── inline bot message editor
      ├── commands.ts                     ── command management and runtime reloading
      ├── ping.ts                         ── ping / heartbeat check
      ├── say.ts                          ── basic message proxy
      ├── setup-signup.ts                 ── generates sign-up help card
      ├── signup.ts                       ── self-service member sign-up link
      └── stop.ts                         ── administrative bot shutdown
```

---

## External Integrations

| Service            | How                       | Purpose                                                |
| :----------------- | :------------------------ | :----------------------------------------------------- |
| Discord API        | discord.js + REST         | Bot operations and command registration                |
| Discord Webhooks   | `WebhookClient`           | In-Discord logging + registration message editing      |
| Google Apps Script | HTTP POST (`SCRIPT_LINK`) | Sync member approval/disapproval back to Google Sheets |
| Google Forms       | URL link in embeds        | Pre-filled sign-up form for new members                |
