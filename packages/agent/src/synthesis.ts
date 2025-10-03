import type { GeminiClient } from '@youagent/ai';
import type { ContextItem } from './context.js';
import { getLogger } from '@youagent/utils/logger';

const logger = getLogger();

export interface SynthesisOptions {
  query: string;
  context: ContextItem[];
  stream?: boolean;
}

/**
 * System prompt for synthesis with citations
 */
const SYSTEM_PROMPT = `You are a personal AI agent that helps answer questions about a person based on their public footprint (GitHub, Blog, Resume, Twitter).

Your role:
1. Answer questions using ONLY the provided context
2. ALWAYS cite sources with absolute dates
3. Be concise but comprehensive
4. If information is not in context, say so clearly

Citation format:
- Use inline citations: (Source: GitHub — 2025-09-01)
- Always include the source name and absolute date
- For multiple sources, list them: (Sources: GitHub — 2025-09-01; Blog — 2025-08-15)

Example:
"The user is an expert in React and TypeScript, having built several popular open-source libraries (Source: GitHub — 2025-09-15). They recently wrote about advanced React patterns (Source: Blog — 2025-08-20)."

Guidelines:
- Never invent or assume information not in context
- Always use absolute dates (YYYY-MM-DD format)
- Be precise about what sources say
- Acknowledge gaps in knowledge`;

/**
 * Synthesize answer from context using Gemini
 */
export async function synthesize(gemini: GeminiClient, options: SynthesisOptions): Promise<string> {
  const { query, context } = options;

  // Build context string
  const contextString = context
    .map((item, idx) => {
      const date = item.date ? new Date(item.date).toISOString().split('T')[0] : 'Unknown date';
      return `[${idx + 1}] Source: ${item.source}${item.title ? ` — ${item.title}` : ''} (${date})
${item.url ? `URL: ${item.url}\n` : ''}Content: ${item.content}
`;
    })
    .join('\n---\n\n');

  const userPrompt = `Context:
${contextString}

---

Question: ${query}

Answer (with citations):`;

  try {
    const response = await gemini.chat({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
    });

    return response.content;
  } catch (error) {
    logger.error('Synthesis failed', { error });
    throw error;
  }
}

/**
 * Synthesize answer with streaming
 */
export async function* synthesizeStream(
  gemini: GeminiClient,
  options: SynthesisOptions
): AsyncGenerator<string, void, unknown> {
  const { query, context } = options;

  // Build context string
  const contextString = context
    .map((item, idx) => {
      const date = item.date ? new Date(item.date).toISOString().split('T')[0] : 'Unknown date';
      return `[${idx + 1}] Source: ${item.source}${item.title ? ` — ${item.title}` : ''} (${date})
${item.url ? `URL: ${item.url}\n` : ''}Content: ${item.content}
`;
    })
    .join('\n---\n\n');

  const userPrompt = `Context:
${contextString}

---

Question: ${query}

Answer (with citations):`;

  try {
    const stream = gemini.chatStream({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (error) {
    logger.error('Synthesis stream failed', { error });
    throw error;
  }
}

