import { describe, expect, it } from 'vitest';

import { decodeJsonBody, errorMessageFromBody, httpStatus, isUnavailableInCountry } from './http-errors';

describe('errorMessageFromBody', () => {
  it('uses the backend message contract', () => {
    expect(errorMessageFromBody({ success: false, message: 'Already exists' }, 409)).toBe(
      'Already exists',
    );
  });

  it('joins bean validation field errors', () => {
    expect(errorMessageFromBody({ username: 'Must be valid', email: 'Required' }, 400)).toBe(
      'Must be valid\nRequired',
    );
  });

  it('provides a useful empty 401 message', () => {
    expect(errorMessageFromBody(null, 401)).toBe('Your session expired. Sign in again.');
  });
});

describe('decodeJsonBody', () => {
  it('accepts successful 200 responses with an empty body', () => {
    expect(decodeJsonBody<void>('')).toBeUndefined();
  });

  it('decodes normal JSON responses', () => {
    expect(decodeJsonBody<{ id: number }>('{"id":7}')).toEqual({ id: 7 });
  });
});

describe('httpStatus', () => {
  it('reads the status an API error carries', () => {
    expect(httpStatus(Object.assign(new Error('Gone'), { status: 451 }))).toBe(451);
  });

  it('is null for failures that never reached the server', () => {
    expect(httpStatus(Object.assign(new Error('Timed out'), { status: 0 }))).toBeNull();
    expect(httpStatus(new Error('Network request failed'))).toBeNull();
    expect(httpStatus(null)).toBeNull();
  });
});

describe('isUnavailableInCountry', () => {
  it('recognises 451 and nothing else', () => {
    expect(isUnavailableInCountry({ status: 451 })).toBe(true);
    expect(isUnavailableInCountry({ status: 404 })).toBe(false);
    expect(isUnavailableInCountry(undefined)).toBe(false);
  });
});
