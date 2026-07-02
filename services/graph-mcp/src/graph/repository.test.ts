import { describe, expect, test } from 'vitest';
import {
  buildCypherLimit,
  buildRelateCypher,
  buildUpsertFactCypher,
  normalizeLimit
} from './repository.js';

describe('Neo4j query limits', () => {
  test('normalizes float-like MCP numeric limits before Cypher uses them', () => {
    expect(normalizeLimit(10.8)).toBe(10);
    expect(normalizeLimit(0)).toBe(1);
    expect(normalizeLimit(999, 100)).toBe(100);
  });

  test('casts parameterized limits to integers inside Cypher', () => {
    expect(buildCypherLimit('limit')).toBe('LIMIT toInteger($limit)');
  });

  test('sets custom properties as top-level primitive Neo4j properties instead of nested maps', () => {
    const factCypher = buildUpsertFactCypher();
    const relationCypher = buildRelateCypher();

    expect(factCypher).toContain('SET n += $properties,');
    expect(factCypher).not.toContain('n.custom_properties = $properties');
    expect(relationCypher).toContain('SET r += $properties,');
    expect(relationCypher).not.toContain('r.custom_properties = $properties');
  });
});
