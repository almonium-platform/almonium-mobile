import { describe, expect, it } from 'vitest';

import {
  countryName,
  countryOptions,
  matchCountries,
  reportFailure,
  reportMissing,
  reportRequest,
  reportThanks,
} from './rights-report';

const ready = { role: 'READER' as const, email: '', message: 'The translation is still protected.', guest: false };

describe('reportMissing', () => {
  it('asks who is writing first, since the role starts unselected', () => {
    expect(reportMissing({ ...ready, role: null })).toBe('Say who you are.');
  });

  it('counts down to the shortest message the server takes', () => {
    expect(reportMissing({ ...ready, message: '  wrong  ' })).toBe('Describe the problem: 5 more characters at least.');
  });

  it('refuses a message longer than the server takes', () => {
    expect(reportMissing({ ...ready, message: 'x'.repeat(4001) })).toBe('Shorten the message to 4000 characters.');
  });

  it('needs a usable email from a guest only', () => {
    expect(reportMissing({ ...ready, guest: true })).toBe('Leave your email so we can answer.');
    expect(reportMissing({ ...ready, guest: true, email: 'not-an-address' })).toBe('Check the email address.');
    expect(reportMissing({ ...ready, guest: true, email: ' reader@example.com ' })).toBeNull();
    expect(reportMissing(ready)).toBeNull();
  });
});

describe('reportRequest', () => {
  it('trims the report and leaves out what was not given', () => {
    expect(reportRequest({ ...ready, name: '  ', country: '', message: '  It is under copyright here. ' })).toEqual({
      role: 'READER',
      country: '',
      message: 'It is under copyright here.',
    });
  });

  it('sends a guest’s email and a given name', () => {
    expect(reportRequest({ ...ready, guest: true, email: ' a@b.co ', name: ' Ada ', country: 'DE' })).toEqual({
      role: 'READER',
      country: 'DE',
      message: ready.message,
      name: 'Ada',
      email: 'a@b.co',
    });
  });
});

describe('report outcomes', () => {
  it('thanks with the address the server names, or the copyright address', () => {
    expect(reportThanks('rights@example.com')).toBe('Thanks — we’ll look at this within a day. You can also write to rights@example.com.');
    expect(reportThanks(null)).toBe('Thanks — we’ll look at this within a day. You can also write to copyright@almonium.com.');
  });

  it('names the rate limit and passes on the server’s reason', () => {
    expect(reportFailure(429, 'Too many reports; try again later.')).toBe('Too many reports from here; try again in an hour.');
    expect(reportFailure(409, 'Leave an email address so we can answer you.')).toBe('Leave an email address so we can answer you.');
    expect(reportFailure(null, null)).toBe('Couldn’t send the report. Try again, or write to copyright@almonium.com.');
    expect(reportFailure(500, 'Internal error')).toBe('Couldn’t send the report. Try again, or write to copyright@almonium.com.');
  });
});

describe('countries', () => {
  const options = countryOptions();

  it('lists every ISO country once, sorted by name', () => {
    expect(options).toHaveLength(249);
    expect(new Set(options.map((option) => option.code)).size).toBe(249);
    expect(options.map((option) => option.name)).toEqual([...options.map((option) => option.name)].sort((a, b) => a.localeCompare(b)));
  });

  it('names a code, and everywhere for none', () => {
    expect(countryName('DE')).toBe('Germany');
    expect(countryName('')).toBe('Everywhere');
  });

  it('matches typed names ignoring accents, prefix matches first', () => {
    expect(matchCountries(options, 'ger')[0].code).toBe('DE');
    expect(matchCountries(options, 'cote').map((option) => option.code)).toContain('CI');
    expect(matchCountries(options, 'us')[0].code).toBe('US');
    expect(matchCountries(options, '  ')).toEqual([]);
  });
});
