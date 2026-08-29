# Contributing to Wright State eSports Discord Bot

Thank you for your interest in contributing to the Wright State eSports Discord Bot! This project was initially created and maintained by officer [Joshua Quaintance](https://github.com/JoshQuaintance).

Please take a moment to review this document before submitting issues, feature requests, or pull requests.

---

## Code of Conduct

Be respectful, constructive, and collaborative. All contributors and maintainers are expected to uphold a welcoming environment for everyone in the Wright State eSports community.

---

## How to Contribute

### Reporting Bugs & Requesting Features

- **Search existing issues** first to avoid duplicates.
- **Provide clear reproductions** with steps, error messages, and environment details (OS, Bun version).
- **Explain the use case** when requesting new commands or features.

### Pull Requests (PRs)

1. **Fork or create a branch** from the `typescript` branch (e.g. `feat/my-feature` or `fix/bug-description`).
2. **Follow code style and architectural patterns** detailed below.
3. **Verify type safety and linting** before committing (`bun x tsc --noEmit`).
4. **Submit a descriptive Pull Request** outlining what changed, why, and how it was tested.

---

## Development Setup

For a full step-by-step developer environment walkthrough, see the [Developer Guide](DEVELOPER_GUIDE.md).

### Quick Setup:

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.development .env.development.local

# 3. Start development server
bun run dev
```

---

## Code Standards & Conventions

### TypeScript & Runtime

- Built on **[Bun](https://bun.sh)** with strict TypeScript.
- Do not use `any` unless strictly necessary for third-party discord.js builder interop.
- Use `satisfies` for commands and event handlers (e.g., `satisfies ChatInputCommand`, `satisfies EventHandler<Events.InteractionCreate>`).

### File & Identifier Naming

- All files use **`kebab-case`** (e.g., `button-interaction.ts`, `new-register.ts`).
- Command filenames **must match** `data.name` exactly.
- Event handler filenames **must match** `name` exactly.

### Commits

Follow standard [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features or enhancements
- `fix:` Bug fixes
- `refactor:` Code refactoring without functionality changes
- `chore:` Maintenance, dependency updates, tooling
- `docs:` Documentation updates

---

## Documentation Links

- 📖 [Developer Guide](DEVELOPER_GUIDE.md) — Comprehensive guide for adding commands, event handlers, configs, and testing.
- 🏗️ [Architecture Guide](ARCHITECTURE.md) — Deep dive into registries, configuration reactivity, and event flows.
- 📄 [License](LICENSE) — Project licensing information.
