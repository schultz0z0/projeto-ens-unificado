import { describe, expect, it } from 'vitest';
import { splitTextForEmbedding } from './text.js';

describe('splitTextForEmbedding', () => {
  it('keeps short semantic chunks unchanged', () => {
    expect(splitTextForEmbedding('abc', 10)).toEqual(['abc']);
  });

  it('splits long text into bounded parts without dropping content', () => {
    const parts = splitTextForEmbedding('aaa\n\nbbb\n\nccc', 8);

    expect(parts.every(part => part.length <= 8)).toBe(true);
    expect(parts.join('\n\n')).toBe('aaa\n\nbbb\n\nccc');
  });
});
