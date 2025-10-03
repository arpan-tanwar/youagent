export * from './types.js';
export * from './sqlite-vss.js';

import { SqliteVssIndex } from './sqlite-vss.js';
import type { VectorIndex } from './types.js';

/**
 * Create a vector index instance
 */
export function createIndex(
  backend: 'sqlite-vss' | 'qdrant',
  config: { dbPath?: string; dimension?: number }
): VectorIndex {
  if (backend === 'sqlite-vss') {
    if (!config.dbPath) {
      throw new Error('dbPath is required for sqlite-vss backend');
    }
    return new SqliteVssIndex(config.dbPath, config.dimension);
  }

  throw new Error(`Unsupported vector backend: ${backend}`);
}

