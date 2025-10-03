import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Source items - raw data from connectors
 */
export const sourceItems = sqliteTable('source_items', {
  id: text('id').primaryKey(), // hash-based ID
  source: text('source').notNull(), // 'github', 'twitter', 'rss', 'resume'
  sourceId: text('source_id').notNull(), // original ID from source
  contentType: text('content_type').notNull(), // 'repo', 'post', 'article', 'fact'
  title: text('title'),
  content: text('content').notNull(),
  url: text('url'),
  publishedAt: text('published_at'), // ISO string
  contentHash: text('content_hash').notNull(),
  metadata: text('metadata'), // JSON string
  fetchedAt: text('fetched_at').notNull(), // ISO string
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Embeddings - vector representations
 */
export const embeddings = sqliteTable('embeddings', {
  id: text('id').primaryKey(),
  sourceItemId: text('source_item_id')
    .notNull()
    .references(() => sourceItems.id, { onDelete: 'cascade' }),
  embedding: text('embedding').notNull(), // JSON array of floats
  model: text('model').notNull(), // embedding model used
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Settings - user preferences and config
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Consent - user consent for data collection
 */
export const consent = sqliteTable('consent', {
  source: text('source').primaryKey(), // 'github', 'twitter', etc.
  granted: integer('granted', { mode: 'boolean' }).notNull().default(false),
  grantedAt: text('granted_at'),
  revokedAt: text('revoked_at'),
});

/**
 * Profile facts - canonical structured data from resume
 */
export const profileFacts = sqliteTable('profile_facts', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // 'work', 'education', 'skill', 'project'
  key: text('key').notNull(), // e.g., 'company', 'role', 'skill_name'
  value: text('value').notNull(),
  startDate: text('start_date'), // ISO string
  endDate: text('end_date'), // ISO string
  metadata: text('metadata'), // JSON
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Type exports
export type SourceItem = typeof sourceItems.$inferSelect;
export type NewSourceItem = typeof sourceItems.$inferInsert;

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type Consent = typeof consent.$inferSelect;
export type NewConsent = typeof consent.$inferInsert;

export type ProfileFact = typeof profileFacts.$inferSelect;
export type NewProfileFact = typeof profileFacts.$inferInsert;

