# YouAgent 🤖

> A production-ready, local-first personal AI agent

YouAgent automatically fetches your public footprint (GitHub, Twitter, Blog, Resume) and builds a local vector index to answer questions about you with proper citations and dates.

## Features

- 🔒 **Privacy-First**: All data stored locally in SQLite
- 🚀 **Fast**: Sub-second responses with smart caching
- 📚 **Multi-Source**: GitHub, Twitter/X, RSS, Resume (PDF)
- 🎯 **Smart Routing**: Intent-based planner selects relevant sources
- 📅 **Always Dated**: All responses include absolute timestamps
- 🛠️ **CLI-First**: Stream responses in your terminal

## Quick Start

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Initialize your agent (first time)
pnpm --filter @youagent/cli dev init

# Chat with your agent
pnpm --filter @youagent/cli dev chat

# Refresh data
pnpm --filter @youagent/cli dev refresh

# Check system health
pnpm --filter @youagent/cli dev doctor
```

## Architecture

```
apps/
  cli/              # CLI application
  web/              # Next.js web UI (coming soon)
packages/
  agent/            # Planner, router, synthesis
  connectors/       # GitHub, Twitter, RSS, Resume
  server/           # Fastify API (for web UI)
  data/             # Drizzle ORM schema & migrations
  index/            # Vector index (sqlite-vss)
  ai/               # Gemini driver & embeddings
  config/           # Environment config loader
  utils/            # Shared utilities
```

## Documentation

- [Quickstart Guide](./docs/QUICKSTART.md)
- [Privacy Policy](./docs/PRIVACY.md)
- [Architecture](./docs/ARCHITECTURE.md)

## Development

```bash
# Run tests
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck

# Format code
pnpm format
```

## License

MIT

