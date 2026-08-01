import { describe, expect, it } from 'vitest';

import { isUuid } from './uuid';

describe('isUuid', () => {
  it('accepts UUID book identifiers', () => {
    expect(isUuid('01989f47-4c2a-7a10-9e5b-751983624a25')).toBe(true);
  });

  it('rejects legacy numeric identifiers', () => {
    expect(isUuid('12')).toBe(false);
  });
});
