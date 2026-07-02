import { describe, expect, test } from 'vitest';
import { buildCypherLimit, normalizeLimit } from './repository.js';

describe('Neo4j query limits', () => {
  test('normalizes float-like MCP numeric limits before Cypher uses them', () => {
    expect(normalizeLimit(10.8)).toBe(10);
    expect(normalizeLimit(0)).toBe(1);
    expect(normalizeLimit(999, 100)).toBe(100);
  });

  test('casts parameterized limits to integers inside Cypher', () => {
    expect(buildCypherLimit('limit')).toBe('LIMIT toInteger($limit)');
  });
});
