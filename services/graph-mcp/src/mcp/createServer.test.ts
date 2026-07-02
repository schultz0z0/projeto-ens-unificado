import { describe, expect, test } from 'vitest';
import { assertValidatedGraphWrite } from './createServer.js';

describe('graph MCP write safety', () => {
  test('blocks graph writes without explicit validation', () => {
    expect(() => assertValidatedGraphWrite({ validated: false, validation_note: 'ok' })).toThrow(/explicit validation/i);
    expect(() => assertValidatedGraphWrite({ validated: true, validation_note: '' })).toThrow(/validation note/i);
  });

  test('allows graph writes with explicit validation and note', () => {
    expect(() => assertValidatedGraphWrite({
      validated: true,
      validation_note: 'Usuario aprovou gravar esta relacao duravel.'
    })).not.toThrow();
  });
});
