/**
 * Document to be indexed
 */
export interface IndexDocument {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Vector index interface - implementation agnostic
 */
export interface VectorIndex {
  /**
   * Upsert documents into the index
   */
  upsert(documents: IndexDocument[], embeddings: number[][]): Promise<void>;

  /**
   * Search for similar documents
   * @param queryEmbedding - Query vector
   * @param k - Number of results to return
   * @returns Sorted results by similarity (highest first)
   */
  search(queryEmbedding: number[], k: number): Promise<SearchResult[]>;

  /**
   * Delete documents by IDs
   */
  delete(ids: string[]): Promise<void>;

  /**
   * Delete all documents
   */
  deleteAll(): Promise<void>;

  /**
   * Get document count
   */
  count(): Promise<number>;
}

