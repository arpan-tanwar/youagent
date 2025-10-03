import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { AIError, RateLimitError } from '@youagent/utils/errors';
import { getLogger } from '@youagent/utils/logger';
import pRetry from 'p-retry';

const logger = getLogger();

export interface ChatOptions {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools?: unknown[]; // Tool definitions
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  toolCalls?: unknown[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EmbeddingOptions {
  model?: string;
}

/**
 * Gemini AI client with retry logic and rate limiting
 */
export class GeminiClient {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private embeddingModel: GenerativeModel;

  constructor(apiKey: string, modelName = 'gemini-1.5-pro') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: modelName });
    this.embeddingModel = this.client.getGenerativeModel({ model: 'text-embedding-004' });
  }

  /**
   * Chat with Gemini (with retry and error handling)
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    return pRetry(
      async () => {
        try {
          const contents: Content[] = options.messages.map((msg) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          }));

          // Add system instruction if provided
          const modelConfig = options.system ? { systemInstruction: options.system } : undefined;

          const chat = this.model.startChat({
            history: contents.slice(0, -1),
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens ?? 2048,
            },
            ...modelConfig,
          });

          const lastMessage = contents[contents.length - 1];
          const result = await chat.sendMessage(lastMessage?.parts[0]?.text ?? '');
          const response = result.response;
          const text = response.text();

          // Log token usage (if available)
          const usageMetadata = (response as any).usageMetadata;
          if (usageMetadata) {
            logger.debug('Token usage', {
              prompt: usageMetadata.promptTokenCount,
              completion: usageMetadata.candidatesTokenCount,
              total: usageMetadata.totalTokenCount,
            });
          }

          return {
            content: text,
            usage: usageMetadata
              ? {
                  promptTokens: usageMetadata.promptTokenCount ?? 0,
                  completionTokens: usageMetadata.candidatesTokenCount ?? 0,
                  totalTokens: usageMetadata.totalTokenCount ?? 0,
                }
              : undefined,
          };
        } catch (error: unknown) {
          // Check for rate limit errors
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status?: number }).status;
            if (status === 429) {
              throw new RateLimitError('Gemini API rate limit exceeded');
            }
          }
          throw new AIError('Gemini chat failed', { cause: error });
        }
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(
            `Chat attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          );
        },
      }
    );
  }

  /**
   * Chat with streaming response
   */
  async *chatStream(options: ChatOptions): AsyncGenerator<string, void, unknown> {
    try {
      const contents: Content[] = options.messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const modelConfig = options.system ? { systemInstruction: options.system } : undefined;

      const chat = this.model.startChat({
        history: contents.slice(0, -1),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
        ...modelConfig,
      });

      const lastMessage = contents[contents.length - 1];
      const result = await chat.sendMessageStream(lastMessage?.parts[0]?.text ?? '');

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error) {
      throw new AIError('Gemini stream failed', { cause: error });
    }
  }

  /**
   * Generate embeddings for texts
   */
  async embed(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    return pRetry(
      async () => {
        try {
          const embeddings: number[][] = [];

          for (const text of texts) {
            const result = await this.embeddingModel.embedContent(text);
            embeddings.push(result.embedding.values);
          }

          return embeddings;
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status?: number }).status;
            if (status === 429) {
              throw new RateLimitError('Gemini API rate limit exceeded');
            }
          }
          throw new AIError('Gemini embedding failed', { cause: error });
        }
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(
            `Embed attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          );
        },
      }
    );
  }
}

// Singleton instance
let geminiClient: GeminiClient | null = null;

export function initGemini(apiKey: string, model?: string): GeminiClient {
  geminiClient = new GeminiClient(apiKey, model);
  return geminiClient;
}

export function getGemini(): GeminiClient {
  if (!geminiClient) {
    throw new AIError('Gemini client not initialized. Call initGemini first.');
  }
  return geminiClient;
}
