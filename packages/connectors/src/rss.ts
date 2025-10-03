import Parser from 'rss-parser';
import { sha256 } from '@youagent/utils/hash';
import { now, toISOString } from '@youagent/utils/date';
import { ConnectorError } from '@youagent/utils/errors';
import { load } from 'cheerio';
import type { SourceItem } from './types.js';

export interface RSSConnectorOptions {
  url: string;
  maxItems?: number;
}

/**
 * RSS/Blog connector - fetches articles from RSS feeds
 */
export class RSSConnector {
  private parser: Parser;

  constructor(private options: RSSConnectorOptions) {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'YouAgent/0.1.0',
      },
    });
  }

  async fetch(): Promise<SourceItem[]> {
    const items: SourceItem[] = [];
    const fetchedAt = now();

    try {
      const feed = await this.parser.parseURL(this.options.url);
      const maxItems = this.options.maxItems ?? 20;

      for (const item of feed.items.slice(0, maxItems)) {
        if (!item.title || !item.link) continue;

        // Extract and clean content
        const content = this.extractContent(item);
        const publishedAt = item.pubDate ? toISOString(item.pubDate) : fetchedAt;

        items.push({
          id: `rss-${sha256(item.link)}`,
          source: 'rss',
          sourceId: item.link,
          contentType: 'article',
          title: item.title,
          content,
          url: item.link,
          publishedAt,
          contentHash: sha256(content),
          metadata: {
            author: item.creator,
            categories: item.categories,
          },
          fetchedAt,
        });
      }

      return items;
    } catch (error) {
      throw new ConnectorError('RSS fetch failed', { cause: error });
    }
  }

  private extractContent(item: Parser.Item): string {
    const rawContent = item.contentSnippet || item.content || item.summary || '';

    // Strip HTML tags and clean up
    const $ = load(rawContent);
    let text = $.text();

    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Limit length
    return text.substring(0, 5000);
  }
}

