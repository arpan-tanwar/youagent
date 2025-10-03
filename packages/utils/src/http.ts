import { request } from 'undici';
import type { Dispatcher } from 'undici';
import pRetry from 'p-retry';
import { ConnectorError } from './errors.js';

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeout?: number;
  maxRedirects?: number;
  retries?: number;
}

/**
 * Fetch with retry, timeout, and redirect limits
 */
export async function safeFetch(
  url: string,
  options: FetchOptions = {}
): Promise<{ body: string; headers: Record<string, string>; status: number }> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 30000,
    maxRedirects = 3,
    retries = 3,
  } = options;

  return pRetry(
    async () => {
      const requestOptions = {
        method,
        headers: {
          'User-Agent': 'YouAgent/0.1.0',
          ...headers,
        },
        body,
        headersTimeout: timeout,
        bodyTimeout: timeout,
        maxRedirections: maxRedirects,
      };

      try {
        const response = await request(url, requestOptions);
        const bodyText = await response.body.text();

        if (response.statusCode >= 400) {
          throw new ConnectorError(`HTTP ${response.statusCode}: ${url}`, {
            status: response.statusCode,
            body: bodyText.substring(0, 500),
          });
        }

        return {
          body: bodyText,
          headers: response.headers as Record<string, string>,
          status: response.statusCode,
        };
      } catch (error) {
        if (error instanceof ConnectorError) {
          throw error;
        }
        throw new ConnectorError(`Failed to fetch ${url}`, { cause: error });
      }
    },
    {
      retries,
      onFailedAttempt: (error) => {
        console.warn(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      },
    }
  );
}

/**
 * Parse Content-Type header
 */
export function parseContentType(contentType?: string): {
  type: string;
  charset?: string;
} {
  if (!contentType) {
    return { type: 'application/octet-stream' };
  }

  const [type, ...params] = contentType.split(';').map((s) => s.trim());
  const charsetParam = params.find((p) => p.startsWith('charset='));
  const charset = charsetParam?.split('=')[1];

  return { type: type ?? 'application/octet-stream', charset };
}

/**
 * Check if URL is allowed (basic allowlist for safety)
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:'];

    if (!allowedProtocols.includes(parsed.protocol)) {
      return false;
    }

    // Block localhost and private IPs (basic check)
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('169.254.')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
