import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { resolve, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

// Load .env file from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../..');
loadDotenv({ path: resolve(projectRoot, '.env') });

/**
 * Configuration schema with strict validation and sensible defaults
 */
const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Agent home directory
  youagentHome: z.string().default(resolve(homedir(), '.youagent')),

  // Database
  dbPath: z.string().optional(),

  // Vector backend
  vectorBackend: z.enum(['sqlite-vss', 'qdrant']).default('sqlite-vss'),

  // Gemini API
  geminiApiKey: z.string().min(1, 'GEMINI_API_KEY is required'),
  geminiModel: z.string().default('gemini-1.5-pro'),

  // Connectors (optional for init, required when used)
  githubToken: z.string().optional(),
  twitterRssUrl: z.string().url().optional(),
  siteRssUrl: z.string().url().optional(),

  // Rate limiting
  maxRequestsPerMinute: z.number().int().positive().default(10),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Parse and validate environment configuration
 * @throws {z.ZodError} if required variables are missing or invalid
 */
export function loadConfig(): Config {
  const raw = {
    nodeEnv: process.env.NODE_ENV,
    youagentHome: process.env.YOUAGENT_HOME,
    dbPath: process.env.DB_PATH,
    vectorBackend: process.env.VECTOR_BACKEND,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    githubToken: process.env.GITHUB_TOKEN,
    twitterRssUrl: process.env.TWITTER_RSS_URL,
    siteRssUrl: process.env.SITE_RSS_URL,
    maxRequestsPerMinute: process.env.MAX_REQUESTS_PER_MINUTE
      ? parseInt(process.env.MAX_REQUESTS_PER_MINUTE, 10)
      : undefined,
  };

  const config = configSchema.parse(raw);

  // Compute dbPath if not provided
  if (!config.dbPath) {
    config.dbPath = resolve(config.youagentHome, 'youagent.db');
  }

  return config;
}

/**
 * Validate config without throwing (useful for doctor command)
 */
export function validateConfig(): { success: boolean; errors?: z.ZodError } {
  try {
    loadConfig();
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

// Export singleton instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// For testing: reset config
export function resetConfig(): void {
  configInstance = null;
}

