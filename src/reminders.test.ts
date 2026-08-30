import { describe, expect, it } from 'vitest';

import { normalizeReminderHour } from './reminder-utils';

describe('review reminder settings', () => {
  it('keeps valid whole hours', () => {
    expect(normalizeReminderHour(18)).toBe(18);
    expect(normalizeReminderHour(23)).toBe(23);
  });

  it('falls back to the evening for invalid values', () => {
    expect(normalizeReminderHour(-1)).toBe(20);
    expect(normalizeReminderHour(24)).toBe(20);
    expect(normalizeReminderHour('18')).toBe(20);
  });
});
