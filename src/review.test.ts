import { describe, expect, it } from 'vitest';

import { intentInstruction, intentLabel } from './review';

describe('review presentation', () => {
  it('names receptive and confusion intents in product language', () => {
    expect(intentLabel('UNDERSTAND')).toBe('Understand');
    expect(intentLabel('DISAMBIGUATE')).toBe('Tell apart');
  });

  it('asks for the exact form when telling items apart', () => {
    expect(intentInstruction('DISAMBIGUATE')).toContain('exact word');
  });
});
