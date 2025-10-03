import Parser from 'rss-parser';
import { sha256 } from '@youagent/utils/hash';
import { now, toISOString } from '@youagent/utils/date';
import { ConnectorError } from '@youagent/utils/errors';
import { load } from 'cheerio';
import type { SourceItem } from './types.js';

export interface TwitterConnectorOptions {
  rssUrl: string; // RSSHub or other RSS URL for tweets
  maxItems?: number;
}

/**
 * Twitter connector via RSS (using RSSHub or similar)
 *
 * Note: Twitter's official API requires OAuth2. For simplicity,
 * we use RSS feeds (e.g., via RSSHub) for MVP.
 */
export class TwitterConnector {
  private parser: Parser;

  constructor(private options: TwitterConnectorOptions) {
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
      const feed = await this.parser.parseURL(this.options.rssUrl);
      const maxItems = this.options.maxItems ?? 50;

      for (const item of feed.items.slice(0, maxItems)) {
        if (!item.title && !item.contentSnippet) continue;

        // Clean content
        const content = this.cleanTweetContent(item.contentSnippet || item.content || '');
        const publishedAt = item.pubDate ? toISOString(item.pubDate) : fetchedAt;
        const tweetId = this.extractTweetId(item.link || item.guid || '');

        items.push({
          id: `twitter-${tweetId || sha256(content)}`,
          source: 'twitter',
          sourceId: tweetId || content.substring(0, 50),
          contentType: 'post',
          title: item.title,
          content,
          url: item.link,
          publishedAt,
          contentHash: sha256(content),
          fetchedAt,
        });
      }

      return items;
    } catch (error) {
      throw new ConnectorError('Twitter RSS fetch failed', { cause: error });
    }
  }

  private cleanTweetContent(rawContent: string): string {
    // Strip HTML
    const $ = load(rawContent);
    let text = $.text();

    // Remove tracking links, shorten URLs
    text = text.replace(/https?:\/\/t\.co\/\w+/g, '');

    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  private extractTweetId(url: string): string | null {
    const match = url.match(/status\/(\d+)/);
    return match?.[1] ?? null;
  }
}

