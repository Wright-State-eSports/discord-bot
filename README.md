# Wright State eSports Discord Bot

<p align="center">
    <img src="WrightStateeSportsLogo.png" alt="Wright State eSports Logo" width="300" />
</p>

It looks like you've stumbled upon the source code for the Wright State eSports Discord Bot!  
The Discord bot is mainly for the Wright State eSports servers.

&nbsp;

> [!NOTE]  
> The bot runs on **[Bun](https://bun.sh)** with TypeScript and **[discord.js](https://discord.js.org)**.

---

> [!IMPORTANT]  
> Join the official Wright State eSports Discord Server!  
> 🔗 **http://discord.gg/PG9p6DNXsy**

---

## Features

- **Member Sign-Up Pipeline** — Intercepts registration webhooks from Google Sheets/Forms, performs fuzzy member matching (`fuse.js`), and surfaces interactive top-5 member selection menus + one-click approval buttons.
- **Announcement Studio** — Open private, in-chat staging threads (`/announce`) to draft, format, and publish multi-line announcements directly to any channel with live `@mentions` and no embed restrictions.
- **Announcement & Message Editing** — Revise long-form announcements in a dedicated private studio thread (`/edit-announcement`) with copyable raw markdown blocks, or quickly edit inline (`/quick-edit` and context menu).
- **Role Management** — Automatically manages `Raider` (full member), `Guest`, and `Not-Signed-Up` roles on approval or cancellation.
- **Google Sheets Sync** — Notifies Google Apps Script webhooks in real-time when a member is approved or disapproved.
- **In-Discord Logging** — Streams structured log events and errors to an admin channel via a silent webhook sink (`DiscordLogger`).
- **Dynamic Command & Event Registries** — Hot-reloadable commands with automatic routing for slash commands, select menus, and context menus.
- **Startup Registration Sweep** — Automatically checks for and processes unprocessed webhook messages on startup.

---

## Documentation

For development setup instructions, configuration details, architecture overviews, and contribution standards, please refer to the dedicated guides:

| Guide                                             | Description                                                                       |
| :------------------------------------------------ | :-------------------------------------------------------------------------------- |
| 📖 [**Developer Guide**](DEVELOPER_GUIDE.md)      | Setup instructions, environment variables, config schema, commands, and debugging |
| 🏗️ [**Architecture Guide**](ARCHITECTURE.md)      | System overview, bot lifecycle, registries, and reactive configuration            |
| 🤝 [**Contribution Guidelines**](CONTRIBUTING.md) | Standards for submitting pull requests, code style, and commit workflow           |

---

## Contributing

This Discord bot was initially created and maintained by our officer [Joshua Quaintance](https://github.com/JoshQuaintance).

If you would like to contribute to this repository, please read the contribution guidelines:

> [!IMPORTANT]  
> 🤝 [**Contribution Guidelines (CONTRIBUTING.md)**](CONTRIBUTING.md)

---

## [License](LICENSE)

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.
