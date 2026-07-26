import { describe, expect, it } from 'vitest';

import { decodeJsonBody, errorMessageFromBody } from './http-errors';

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
