import type { VectorIndex, SearchResult } from '@youagent/index';
import type { SourceItem } from '@youagent/data';
import { getLogger } from '@youagent/utils/logger';

const logger = getLogger();

export interface ContextItem {
  content: string;
  source: string;
  title?: string;
  url?: string;
  date?: string;
}

/**
 * Pick context from vector search results and source items
 */
export async function pickContext(
  query: string,
  queryEmbedding: number[],
  vectorIndex: VectorIndex,
  sourceItems: SourceItem[],
  options: {
    maxResults: number;
    maxTokensPerSource?: number;
  }
): Promise<ContextItem[]> {
  const { maxResults, maxTokensPerSource = 500 } = options;

  try {
    // Search vector index
    const searchResults = await vectorIndex.search(queryEmbedding, maxResults);

    // Map results to source items
    const contextItems: ContextItem[] = [];
    const seenSources = new Set<string>();

    for (const result of searchResults) {
      const sourceItem = sourceItems.find((item) => item.id === result.id);
      if (!sourceItem) continue;

      // Enforce source diversity (max 3 items per source)
      const sourceKey = sourceItem.source;
      const sourceCount = Array.from(seenSources).filter((s) => s === sourceKey).length;
      if (sourceCount >= 3) continue;

      seenSources.add(sourceKey);

      // Truncate content to token limit (rough approximation: 1 token ≈ 4 chars)
      const maxChars = maxTokensPerSource * 4;
      const content =
        sourceItem.content.length > maxChars
          ? sourceItem.content.substring(0, maxChars) + '...'
          : sourceItem.content;

      contextItems.push({
        content,
        source: sourceItem.source,
        title: sourceItem.title ?? undefined,
        url: sourceItem.url ?? undefined,
        date: sourceItem.publishedAt || sourceItem.fetchedAt,
      });
    }

    logger.debug('Context picked', { count: contextItems.length });
    return contextItems;
  } catch (error) {
    logger.error('Failed to pick context', { error });
    return [];
  }
}
