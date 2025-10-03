/**
 * Date utilities - always use ISO strings, always absolute dates
 */

/**
 * Get current timestamp as ISO string
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Parse various date formats to ISO string
 */
export function toISOString(date: Date | string | number): string {
  if (date instanceof Date) {
    return date.toISOString();
  }
  return new Date(date).toISOString();
}

/**
 * Check if date string is valid ISO format
 */
export function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString() === dateString;
}

/**
 * Format ISO date for human display (e.g., "2025-09-15")
 */
export function formatDate(isoString: string): string {
  return isoString.split('T')[0] ?? isoString;
}

/**
 * Calculate age of data in seconds
 */
export function ageInSeconds(isoString: string): number {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  return Math.floor((now - then) / 1000);
}

/**
 * Check if data is stale (older than ttl seconds)
 */
export function isStale(isoString: string, ttlSeconds: number): boolean {
  return ageInSeconds(isoString) > ttlSeconds;
}

