# Privacy Policy

YouAgent is designed with privacy as a core principle.

## Data Storage

### Local-First Architecture

- **All data stored locally** in `~/.youagent/`
- SQLite database at `~/.youagent/youagent.db`
- Vector index at `~/.youagent/vectors.db`
- No cloud sync by default

### What Gets Stored

1. **Source Items:** Raw data from GitHub, RSS, Resume, Twitter
2. **Embeddings:** Vector representations of your content
3. **Settings:** User preferences and consent records
4. **Profile Facts:** Structured data from your resume

## Data Collection

### Consent-Based

- You explicitly grant consent for each data source during `init`
- Consent can be revoked at any time
- Revoked sources are immediately deleted

### Public Data Only

- **GitHub:** Public repos, profile, READMEs
- **RSS/Blog:** Publicly accessible articles
- **Resume:** Your uploaded PDF (local file only)
- **Twitter/X:** Public tweets via RSS

**We never access:**

- Private repositories
- DMs or private messages
- Email or phone numbers
- Payment information

## External Services

### Gemini API

- **What's sent:** Your prompts + selected context chunks
- **What's not sent:** Your full database or raw files
- **Retention:** Follow Google's [Gemini API terms](https://ai.google.dev/terms)
- **PII:** We redact tokens and keys before logging

### GitHub API

- **Authentication:** Personal access token (stored in `.env`)
- **Scope:** Read-only public data
- **Rate limits:** Respects GitHub's limits

## Security Practices

### Token Storage

- API keys stored in `.env` (gitignored)
- Never logged or printed
- Redacted from error messages

### Content Sanitization

- HTML stripped from RSS/blog posts
- Remote images/scripts blocked
- No code execution from fetched content

### Network Safety

- HTTPS only for external requests
- Timeouts and size limits enforced
- No redirects to private IPs

## Delete All Data

To completely wipe your agent:

```bash
rm -rf ~/.youagent
```

This deletes:

- All source items
- All embeddings
- Settings and consent records
- Cached data

Your `.env` file remains (you can delete it manually).

## Logging

- Logs written to stdout as JSONL
- **Redacted fields:** `token`, `apikey`, `password`, `secret`
- Token usage logged (no PII)

## Compliance

YouAgent is a **local tool** and not a service. As such:

- No GDPR obligations (you control your data)
- No user tracking or analytics
- No telemetry or crash reporting

## Questions?

This is an open-source project. Review the code:

- Config loader: `packages/config/src/index.ts`
- Connectors: `packages/connectors/src/`
- Database schema: `packages/data/src/schema.ts`

For concerns, open an issue on GitHub.

