import { eq, and } from 'drizzle-orm';
import { getDb } from './client.js';
import * as schema from './schema.js';
import type {
  SourceItem,
  NewSourceItem,
  Embedding,
  NewEmbedding,
  Setting,
  NewSetting,
  Consent,
  NewConsent,
  ProfileFact,
  NewProfileFact,
} from './schema.js';

/**
 * Source Items Repository
 */
export const sourceItemsRepo = {
  async create(item: NewSourceItem): Promise<SourceItem> {
    const db = getDb();
    const result = await db.insert(schema.sourceItems).values(item).returning();
    return result[0]!;
  },

  async findById(id: string): Promise<SourceItem | undefined> {
    const db = getDb();
    const result = await db.select().from(schema.sourceItems).where(eq(schema.sourceItems.id, id));
    return result[0];
  },

  async findBySource(source: string): Promise<SourceItem[]> {
    const db = getDb();
    return db.select().from(schema.sourceItems).where(eq(schema.sourceItems.source, source));
  },

  async upsert(item: NewSourceItem): Promise<SourceItem> {
    const existing = await this.findById(item.id);
    const db = getDb();

    if (existing) {
      const result = await db
        .update(schema.sourceItems)
        .set({ ...item, updatedAt: new Date().toISOString() })
        .where(eq(schema.sourceItems.id, item.id))
        .returning();
      return result[0]!;
    }

    return this.create(item);
  },

  async deleteBySource(source: string): Promise<void> {
    const db = getDb();
    await db.delete(schema.sourceItems).where(eq(schema.sourceItems.source, source));
  },

  async deleteAll(): Promise<void> {
    const db = getDb();
    await db.delete(schema.sourceItems);
  },
};

/**
 * Embeddings Repository
 */
export const embeddingsRepo = {
  async create(embedding: NewEmbedding): Promise<Embedding> {
    const db = getDb();
    const result = await db.insert(schema.embeddings).values(embedding).returning();
    return result[0]!;
  },

  async findBySourceItemId(sourceItemId: string): Promise<Embedding | undefined> {
    const db = getDb();
    const result = await db
      .select()
      .from(schema.embeddings)
      .where(eq(schema.embeddings.sourceItemId, sourceItemId));
    return result[0];
  },

  async deleteBySourceItemId(sourceItemId: string): Promise<void> {
    const db = getDb();
    await db.delete(schema.embeddings).where(eq(schema.embeddings.sourceItemId, sourceItemId));
  },

  async deleteAll(): Promise<void> {
    const db = getDb();
    await db.delete(schema.embeddings);
  },
};

/**
 * Settings Repository
 */
export const settingsRepo = {
  async get(key: string): Promise<string | undefined> {
    const db = getDb();
    const result = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
    return result[0]?.value;
  },

  async set(key: string, value: string): Promise<void> {
    const db = getDb();
    const existing = await this.get(key);

    if (existing) {
      await db
        .update(schema.settings)
        .set({ value, updatedAt: new Date().toISOString() })
        .where(eq(schema.settings.key, key));
    } else {
      await db.insert(schema.settings).values({ key, value });
    }
  },

  async delete(key: string): Promise<void> {
    const db = getDb();
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
  },
};

/**
 * Consent Repository
 */
export const consentRepo = {
  async grant(source: string): Promise<void> {
    const db = getDb();
    await db
      .insert(schema.consent)
      .values({
        source,
        granted: true,
        grantedAt: new Date().toISOString(),
        revokedAt: null,
      })
      .onConflictDoUpdate({
        target: schema.consent.source,
        set: {
          granted: true,
          grantedAt: new Date().toISOString(),
          revokedAt: null,
        },
      });
  },

  async revoke(source: string): Promise<void> {
    const db = getDb();
    await db
      .update(schema.consent)
      .set({ granted: false, revokedAt: new Date().toISOString() })
      .where(eq(schema.consent.source, source));
  },

  async isGranted(source: string): Promise<boolean> {
    const db = getDb();
    const result = await db.select().from(schema.consent).where(eq(schema.consent.source, source));
    return result[0]?.granted ?? false;
  },

  async getAll(): Promise<Consent[]> {
    const db = getDb();
    return db.select().from(schema.consent);
  },
};

/**
 * Profile Facts Repository
 */
export const profileFactsRepo = {
  async create(fact: NewProfileFact): Promise<ProfileFact> {
    const db = getDb();
    const result = await db.insert(schema.profileFacts).values(fact).returning();
    return result[0]!;
  },

  async findByCategory(category: string): Promise<ProfileFact[]> {
    const db = getDb();
    return db.select().from(schema.profileFacts).where(eq(schema.profileFacts.category, category));
  },

  async deleteAll(): Promise<void> {
    const db = getDb();
    await db.delete(schema.profileFacts);
  },
};

