import Database from 'better-sqlite3';
import { IndexError } from '@youagent/utils/errors';
import type { VectorIndex, IndexDocument, SearchResult } from './types.js';

/**
 * SQLite-VSS vector index implementation
 *
 * Note: This is a simple implementation using SQLite's built-in capabilities.
 * For production, consider using the sqlite-vss extension or a dedicated vector DB.
 */
export class SqliteVssIndex implements VectorIndex {
  private db: Database.Database;
  private readonly tableName = 'vector_index';
  private readonly dimension: number;

  constructor(dbPath: string, dimension = 768) {
    this.dimension = dimension;
    try {
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.initTable();
    } catch (error) {
      throw new IndexError('Failed to initialize vector index', { cause: error });
    }
  }

  private initTable(): void {
    // Create table for vectors
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        metadata TEXT
      )
    `);

    // Create index on id
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_vector_index_id ON ${this.tableName}(id)
    `);
  }

  async upsert(documents: IndexDocument[], embeddings: number[][]): Promise<void> {
    if (documents.length !== embeddings.length) {
      throw new IndexError('Documents and embeddings length mismatch');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ${this.tableName} (id, embedding, metadata)
        VALUES (?, ?, ?)
      `);

      const insertMany = this.db.transaction((items: Array<[string, string, string | null]>) => {
        for (const item of items) {
          stmt.run(...item);
        }
      });

      const items: Array<[string, string, string | null]> = documents.map((doc, idx) => [
        doc.id,
        JSON.stringify(embeddings[idx]),
        doc.metadata ? JSON.stringify(doc.metadata) : null,
      ]);

      insertMany(items);
    } catch (error) {
      throw new IndexError('Failed to upsert documents', { cause: error });
    }
  }

  async search(queryEmbedding: number[], k: number): Promise<SearchResult[]> {
    try {
      // Fetch all embeddings (naive approach - replace with sqlite-vss for production)
      const stmt = this.db.prepare(`SELECT id, embedding, metadata FROM ${this.tableName}`);
      const rows = stmt.all() as Array<{ id: string; embedding: string; metadata: string | null }>;

      // Calculate cosine similarity
      const results: SearchResult[] = rows.map((row) => {
        const embedding = JSON.parse(row.embedding) as number[];
        const score = cosineSimilarity(queryEmbedding, embedding);
        return {
          id: row.id,
          score,
          metadata: row.metadata
            ? (JSON.parse(row.metadata) as Record<string, unknown>)
            : undefined,
        };
      });

      // Sort by score (highest first) and take top k
      return results.sort((a, b) => b.score - a.score).slice(0, k);
    } catch (error) {
      throw new IndexError('Failed to search index', { cause: error });
    }
  }

  async delete(ids: string[]): Promise<void> {
    try {
      const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
      const deleteMany = this.db.transaction((idList: string[]) => {
        for (const id of idList) {
          stmt.run(id);
        }
      });
      deleteMany(ids);
    } catch (error) {
      throw new IndexError('Failed to delete documents', { cause: error });
    }
  }

  async deleteAll(): Promise<void> {
    try {
      this.db.exec(`DELETE FROM ${this.tableName}`);
    } catch (error) {
      throw new IndexError('Failed to delete all documents', { cause: error });
    }
  }

  async count(): Promise<number> {
    try {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      throw new IndexError('Failed to count documents', { cause: error });
    }
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

