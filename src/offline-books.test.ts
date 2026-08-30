import { describe, expect, it } from 'vitest';

import { formattedDownloadSize } from './offline-utils';

describe('offline book sizes', () => {
  it('formats shelf-friendly sizes', () => {
    expect(formattedDownloadSize(512)).toBe('512 B');
    expect(formattedDownloadSize(1_400)).toBe('1 KB');
    expect(formattedDownloadSize(1_572_864)).toBe('1.5 MB');
  });
});
