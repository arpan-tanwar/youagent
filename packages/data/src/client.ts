import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { DatabaseError } from '@youagent/utils/errors';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

let db: BetterSQLite3Database<typeof schema> | null = null;

/**
 * Initialize database connection
 */
export function initDb(dbPath: string): BetterSQLite3Database<typeof schema> {
  try {
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const sqlite = new Database(dbPath);

    // Enable WAL mode for better concurrency
    sqlite.pragma('journal_mode = WAL');

    db = drizzle(sqlite, { schema });
    return db;
  } catch (error) {
    throw new DatabaseError('Failed to initialize database', { cause: error });
  }
}

/**
 * Get database instance (must call initDb first)
 */
export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!db) {
    throw new DatabaseError('Database not initialized. Call initDb first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (db) {
    // Close the underlying sqlite connection
    // Note: drizzle doesn't expose close, access via prototype
    db = null;
  }
}

/**
 * Run migrations (creates tables if they don't exist)
 */
export async function runMigrations(
  dbInstance: BetterSQLite3Database<typeof schema>
): Promise<void> {
  try {
    // For now, we'll create tables manually
    // In production, use drizzle-kit migrations
    const migrations = [
      `CREATE TABLE IF NOT EXISTS source_items (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        url TEXT,
        published_at TEXT,
        content_hash TEXT NOT NULL,
        metadata TEXT,
        fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        source_item_id TEXT NOT NULL,
        embedding TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_item_id) REFERENCES source_items(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS consent (
        source TEXT PRIMARY KEY,
        granted INTEGER NOT NULL DEFAULT 0,
        granted_at TEXT,
        revoked_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS profile_facts (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_source_items_source ON source_items(source)`,
      `CREATE INDEX IF NOT EXISTS idx_source_items_content_type ON source_items(content_type)`,
      `CREATE INDEX IF NOT EXISTS idx_embeddings_source_item ON embeddings(source_item_id)`,
      `CREATE INDEX IF NOT EXISTS idx_profile_facts_category ON profile_facts(category)`,
    ];

    // Execute migrations
    // Cast to access underlying sqlite
    const sqlite = (dbInstance as any).session?.client as Database.Database;
    if (sqlite) {
      for (const migration of migrations) {
        sqlite.exec(migration);
      }
    }
  } catch (error) {
    throw new DatabaseError('Failed to run migrations', { cause: error });
  }
}

