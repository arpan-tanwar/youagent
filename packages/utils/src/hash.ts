import { createHash } from 'crypto';

/**
 * Generate SHA-256 hash of content
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Generate content hash for cache invalidation
 */
export function contentHash(data: unknown): string {
  const normalized = JSON.stringify(data, Object.keys(data as object).sort());
  return sha256(normalized);
}

