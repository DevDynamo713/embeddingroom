export interface Embedding { id: string; text: string; vector: number[]; source: string; createdAt: string }
export interface SearchResult { embedding: Embedding; similarity: number }

// Deterministic mock embedding from text (hash-based, 128-dim)
export function mockEmbedding(text: string): number[] {
  const dim = 128;
  const vec: number[] = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    vec[i % dim] += (code - 32) / 100;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

// Cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// Search top-K most similar embeddings
export function search(query: string, embeddings: Embedding[], topK: number = 5): SearchResult[] {
  const queryVec = mockEmbedding(query);
  return embeddings
    .map(e => ({ embedding: e, similarity: cosineSimilarity(queryVec, e.vector) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

export function formatEmbedding(e: Embedding): string { return `${e.text.substring(0, 40)} [${e.source}] dim:${e.vector.length}`; }