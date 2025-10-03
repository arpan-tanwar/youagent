# Architecture

YouAgent is a modular, local-first personal AI agent built on TypeScript and Node.js.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User Interface                       │
│  ┌──────────────┐                      ┌─────────────────┐ │
│  │     CLI      │                      │   Web (Future)  │ │
│  │  (Commander) │                      │   (Next.js)     │ │
│  └──────┬───────┘                      └────────┬────────┘ │
└─────────┼───────────────────────────────────────┼──────────┘
          │                                        │
          │                                        │
┌─────────▼────────────────────────────────────────▼──────────┐
│                      Agent Layer                             │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────────┐ │
│  │ Planner  │─>│  Context  │─>│    Synthesis (Gemini)    │ │
│  │ (Intent) │  │  Picker   │  │    (With Citations)      │ │
│  └──────────┘  └───────────┘  └──────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼────┐  ┌────────▼────────┐  ┌───▼──────────┐
│ Connectors   │  │  Vector Index   │  │   Database   │
│              │  │                 │  │              │
│ - GitHub     │  │  sqlite-vss    │  │   SQLite     │
│ - RSS        │  │  (768-dim)     │  │   (Drizzle)  │
│ - Resume     │  │                 │  │              │
│ - Twitter    │  └─────────────────┘  └──────────────┘
└──────────────┘
```

## Core Packages

### 1. **@youagent/config**

- Environment variable loading with `zod` validation
- Type-safe configuration
- Default values and error handling

**Key files:**

- `src/index.ts` - Config loader and validator

### 2. **@youagent/utils**

Shared utilities used across all packages:

- `errors.ts` - Domain-specific error classes
- `http.ts` - Safe HTTP client with retry and timeout
- `logger.ts` - JSONL logger with PII redaction
- `date.ts` - ISO date utilities
- `hash.ts` - Content hashing for cache invalidation

### 3. **@youagent/data**

Database layer using **Drizzle ORM** + SQLite:

- **Schema:**
  - `source_items` - Raw data from connectors
  - `embeddings` - Vector representations
  - `settings` - User preferences
  - `consent` - Source permissions
  - `profile_facts` - Structured resume data

- **Repositories:** Type-safe CRUD operations

### 4. **@youagent/index**

Vector search abstraction:

- Interface: `VectorIndex` (upsert, search, delete)
- Implementation: `SqliteVssIndex` (naive cosine similarity)
- Future: Qdrant, Pinecone, etc.

**Note:** Current implementation is a placeholder. For production scale, integrate [sqlite-vss extension](https://github.com/asg017/sqlite-vss).

### 5. **@youagent/ai**

Gemini driver:

- `GeminiClient` - Chat, streaming, embeddings
- Retry logic with exponential backoff
- Token usage logging
- Rate limit handling

### 6. **@youagent/connectors**

Data fetchers for external sources:

- **GitHubConnector:** Profile, repos, READMEs
- **RSSConnector:** Blog posts via RSS
- **ResumeConnector:** PDF parsing
- **TwitterConnector:** Tweets via RSS (RSSHub)

Each connector returns `SourceItem[]` with standardized schema.

### 7. **@youagent/agent**

Orchestration layer:

- **Planner:** Intent classification (coding, career, branding, general)
- **Context Picker:** Vector search + source diversity
- **Synthesis:** Gemini prompt with citations

## Data Flow

### 1. Initialization (`youagent init`)

```
User → CLI → Prompt for sources → Connectors fetch data
                                ↓
                        Store in DB (source_items)
                                ↓
                        Generate embeddings (Gemini)
                                ↓
                        Upsert to vector index
```

### 2. Chat (`youagent chat`)

```
User question → Planner (classify intent)
                    ↓
              Generate query embedding
                    ↓
              Vector search (top-k)
                    ↓
              Pick context (diversity + token budget)
                    ↓
              Synthesis (Gemini + citations)
                    ↓
              Stream response to user
```

### 3. Refresh (`youagent refresh`)

```
Trigger → Connector fetch → Compare content hashes
                                ↓
                          Only re-embed changed items
                                ↓
                          Upsert to index
```

## Key Design Decisions

### Why Local-First?

- **Privacy:** User controls all data
- **Speed:** No network latency for queries
- **Cost:** No cloud storage fees

### Why SQLite?

- Single file, easy backup
- Fast for <10M records
- ACID guarantees
- No server management

### Why Gemini?

- Generous free tier
- Built-in function calling
- Text embedding included
- Easy to swap (pluggable driver)

### Why Monorepo?

- Shared TypeScript configs
- Fast iteration with Turborepo
- Clear module boundaries
- Easy to extract packages later

## Security Guardrails

1. **Prompt Injection Defense:**
   - Context treated as untrusted data
   - No execution of fetched code
   - URL allowlist

2. **Token Safety:**
   - Stored in `.env` (gitignored)
   - Redacted in logs
   - Never sent to Gemini

3. **Content Sanitization:**
   - HTML stripped (cheerio)
   - Size limits (10KB per item)
   - Timeouts on fetches

## Scalability Considerations

Current MVP supports:

- ~1,000 source items
- ~1,000 embeddings
- Single-user, single-machine

For scale:

- Replace naive cosine similarity with sqlite-vss extension
- Add caching layer (Redis)
- Shard embeddings by source
- Use Qdrant or Pinecone for production vector DB

## Testing Strategy

- **Unit tests:** Vitest for logic (planner, context picker)
- **Integration tests:** Supertest for API (future)
- **E2E tests:** Playwright for web UI (future)

Run tests:

```bash
pnpm test
```

## Future Enhancements

1. **Web UI:** Next.js app with streaming chat
2. **More Connectors:** LinkedIn, HackerNews, Medium
3. **Private Data:** Encrypted local files
4. **Multi-User:** Fastify server with auth
5. **Export:** Markdown summaries, PDF reports

## Contributing

See `CONTRIBUTING.md` (TBD) for guidelines.

## Questions?

Open an issue or read the source:

- Start at `apps/cli/src/index.ts`
- Follow imports to understand flow

