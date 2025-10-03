# Architectural Decisions

This document tracks key technical decisions made during YouAgent development.

## ADR-001: Monorepo with pnpm + Turborepo

**Date:** 2025-10-02

**Context:** Need to organize multiple packages (config, data, connectors, agent, cli) with shared dependencies.

**Decision:** Use pnpm workspaces + Turborepo for build orchestration.

**Rationale:**

- pnpm is faster and more disk-efficient than npm/yarn
- Turborepo provides intelligent caching for builds/tests
- Easy to extract packages later if needed
- Better than a monolith for maintainability

**Alternatives Considered:**

- Lerna (deprecated, less active)
- Yarn workspaces (pnpm is faster)
- Single package (poor separation of concerns)

---

## ADR-002: SQLite + Drizzle ORM

**Date:** 2025-10-02

**Context:** Need a local database for source items, embeddings, and settings.

**Decision:** SQLite with Drizzle ORM.

**Rationale:**

- SQLite: Single file, no server, perfect for local-first
- Drizzle: Type-safe, lightweight, great DX
- WAL mode for better concurrency
- Easy backups (copy the .db file)

**Alternatives Considered:**

- PostgreSQL (overkill, requires server)
- LevelDB (less mature ecosystem)
- Plain files (no ACID guarantees)

---

## ADR-003: Gemini for LLM + Embeddings

**Date:** 2025-10-02

**Context:** Need an LLM for synthesis and embeddings for vector search.

**Decision:** Google Gemini (gemini-1.5-pro + text-embedding-004).

**Rationale:**

- Generous free tier (good for MVP)
- Built-in function calling
- Embeddings included (no separate service)
- Streaming support
- Easy to swap later (driver is pluggable)

**Alternatives Considered:**

- OpenAI (more expensive, rate limits)
- Anthropic Claude (no embeddings, separate service needed)
- Ollama (local, but slower and harder to set up)

---

## ADR-004: Naive Vector Search (MVP)

**Date:** 2025-10-02

**Context:** Need vector search for similarity matching.

**Decision:** Naive cosine similarity in SQLite (no extension for MVP).

**Rationale:**

- Simple to implement
- No external dependencies
- Sufficient for <1,000 embeddings
- Easy to upgrade to sqlite-vss or Qdrant later

**Alternatives Considered:**

- sqlite-vss extension (requires compilation, harder setup)
- Qdrant (local server, more complex)
- Pinecone (cloud-based, against privacy goals)

**Future:** Upgrade to sqlite-vss for production scale.

---

## ADR-005: Commander for CLI

**Date:** 2025-10-02

**Context:** Need a CLI framework for `youagent` commands.

**Decision:** Commander.js

**Rationale:**

- Most popular Node.js CLI framework
- Simple API
- Good TypeScript support
- Battle-tested

**Alternatives Considered:**

- Clipanion (more complex, less popular)
- Oclif (heavyweight, too much boilerplate)
- yargs (older, less intuitive API)

---

## ADR-006: RSS for Twitter/X (MVP)

**Date:** 2025-10-02

**Context:** Twitter API requires OAuth2 and is complex to set up.

**Decision:** Use RSS feeds (via RSSHub or similar) for MVP.

**Rationale:**

- No OAuth flow needed
- Public data only (matches privacy goals)
- Simple to implement
- Users can self-host RSSHub

**Alternatives Considered:**

- Twitter API v2 (complex OAuth, rate limits)
- Scraping (fragile, against ToS)

**Future:** Add official Twitter API support with OAuth when needed.

---

## ADR-007: TypeScript Strict Mode

**Date:** 2025-10-02

**Context:** Need type safety and maintainability.

**Decision:** Enable TypeScript strict mode across all packages.

**Rationale:**

- Catches more bugs at compile time
- Better IDE autocomplete
- Forces explicit types
- Industry best practice

**Enforcement:**

- `"strict": true` in tsconfig.json
- ESLint rule: `@typescript-eslint/no-explicit-any: error`
- Pre-commit hooks (typecheck + lint)

---

## ADR-008: No Cloud Persistence by Default

**Date:** 2025-10-02

**Context:** Privacy is a core value.

**Decision:** All data stored locally in `~/.youagent/`. No cloud sync.

**Rationale:**

- User controls their data
- No vendor lock-in
- No cloud storage costs
- Compliant with GDPR principles

**Future:** Add optional cloud sync (encrypted) if users request it.

---

## ADR-009: Public Data Only

**Date:** 2025-10-02

**Context:** What data sources to support in MVP?

**Decision:** Only public data (GitHub public repos, public tweets, blog RSS, uploaded resume).

**Rationale:**

- Simpler authentication (tokens, not OAuth flows)
- Clear privacy boundaries
- No risk of leaking private data

**Future:** Add private repo support with explicit consent.

---

## ADR-010: JSONL Logging

**Date:** 2025-10-02

**Context:** Need structured logging for debugging.

**Decision:** Write logs as JSONL (JSON Lines) to stdout.

**Rationale:**

- Machine-parseable (for monitoring tools)
- Human-readable (with jq)
- Standard format
- Easy to redact PII

**Example:**

```json
{
  "timestamp": "2025-10-02T12:00:00Z",
  "level": "info",
  "message": "GitHub fetch complete",
  "context": { "items": 42 }
}
```

---

## Future Decisions

- [ ] Web UI framework (Next.js vs Remix)
- [ ] Authentication for multi-user (if needed)
- [ ] Deployment strategy (Docker, systemd, etc.)
- [ ] Cloud sync provider (if added)

