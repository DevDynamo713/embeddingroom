import { describe, it, expect } from 'vitest';
import { mockEmbedding, cosineSimilarity, search, formatEmbedding } from './embedding';
describe('embedding', () => {
  it('mockEmbedding returns 128-dim normalized vector', () => {
    const v = mockEmbedding('hello');
    expect(v.length).toBe(128);
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(mag).toBeCloseTo(1, 5);
  });
  it('cosineSimilarity of identical vectors = 1', () => {
    const v = mockEmbedding('test');
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });
  it('cosineSimilarity of orthogonal vectors ~ 0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });
  it('search returns topK sorted by similarity', () => {
    const embeddings = [
      { id: '1', text: 'cat', vector: mockEmbedding('cat'), source: 's', createdAt: 't' },
      { id: '2', text: 'dog', vector: mockEmbedding('dog'), source: 's', createdAt: 't' },
      { id: '3', text: 'kitten', vector: mockEmbedding('kitten'), source: 's', createdAt: 't' }
    ];
    const results = search('cat', embeddings, 2);
    expect(results.length).toBe(2);
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
    expect(results[0].embedding.text).toBe('cat');
  });
  it('search with empty embeddings returns []', () => {
    expect(search('test', [], 5)).toEqual([]);
  });
  it('formats correctly', () => {
    const e = { id: '1', text: 'hello world', vector: mockEmbedding('hello world'), source: 'wiki', createdAt: 't' };
    expect(formatEmbedding(e)).toBe('hello world [wiki] dim:128');
  });
});