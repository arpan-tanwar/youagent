import { z } from 'zod';

/**
 * Common source item schema
 */
export const sourceItemSchema = z.object({
  id: z.string(),
  source: z.enum(['github', 'twitter', 'rss', 'resume']),
  sourceId: z.string(),
  contentType: z.enum(['repo', 'post', 'article', 'fact', 'profile']),
  title: z.string().optional(),
  content: z.string(),
  url: z.string().optional(),
  publishedAt: z.string().optional(), // ISO date
  contentHash: z.string(),
  metadata: z.record(z.unknown()).optional(),
  fetchedAt: z.string(), // ISO date
});

export type SourceItem = z.infer<typeof sourceItemSchema>;

/**
 * Connector interface
 */
export interface Connector {
  name: string;
  fetch(): Promise<SourceItem[]>;
}

