# Quickstart Guide

Get YouAgent up and running in under 5 minutes.

## Prerequisites

- Node.js 20+ and pnpm 8+
- Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
- GitHub personal access token ([Create here](https://github.com/settings/tokens))

## Installation

1. **Clone and install dependencies:**

```bash
git clone <repo-url>
cd personal-agent
pnpm install
```

2. **Set up environment:**

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```
GEMINI_API_KEY=your_gemini_api_key_here
GITHUB_TOKEN=your_github_token_here
```

3. **Build packages:**

```bash
pnpm build
```

## Initialize Your Agent

Run the initialization wizard:

```bash
pnpm --filter @youagent/cli dev init
```

This will:

- Create `~/.youagent` directory
- Set up SQLite database
- Initialize vector index
- Fetch your GitHub data
- Optionally: parse your resume, fetch blog posts, Twitter/X data
- Generate embeddings for all content

**Expected time:** 2-5 minutes depending on data size

## Start Chatting

```bash
pnpm --filter @youagent/cli dev chat
```

Try these example questions:

- "Draft a cover letter for a React role"
- "What are my most popular GitHub projects?"
- "Summarize my latest blog posts"
- "What technologies do I work with?"

## Refresh Data

Update your agent's knowledge:

```bash
# Refresh all sources
pnpm --filter @youagent/cli dev refresh --all

# Refresh specific sources
pnpm --filter @youagent/cli dev refresh --github
```

## Check System Health

```bash
pnpm --filter @youagent/cli dev doctor
```

This validates:

- Environment configuration
- Database connectivity
- Vector index status
- Gemini API connection

## Next Steps

- Read [Architecture](./ARCHITECTURE.md) to understand how it works
- Review [Privacy](./PRIVACY.md) to understand data handling
- Customize the planner in `packages/agent/src/planner.ts`
- Add more connectors in `packages/connectors/`

## Troubleshooting

**Database errors:**

```bash
rm -rf ~/.youagent
pnpm --filter @youagent/cli dev init
```

**API rate limits:**

- Gemini has rate limits. Wait and retry.
- GitHub token needs `repo:read` scope.

**Missing embeddings:**

```bash
pnpm --filter @youagent/cli dev refresh --all
```
