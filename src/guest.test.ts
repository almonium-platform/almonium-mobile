import { describe, expect, it } from 'vitest';
import { guestTranslationLanguage, readerReturnPath, safeReturnPath } from './guest';

describe('guest reading', () => {
  it('pairs the word card with the phone language, never the book language', () => {
    expect(guestTranslationLanguage(['de-AT', 'en-US'], 'EN')).toBe('DE');
    expect(guestTranslationLanguage(['en-GB'], 'en')).toBe('UK');
    expect(guestTranslationLanguage([], 'UK')).toBe('EN');
    expect(guestTranslationLanguage(['pseudo-x'], 'EN')).toBe('UK');
  });
  it('returns only to in-app paths after signing in', () => {
    expect(safeReturnPath('/reader/abc?slug=x&title=Frankenstein')).toBe('/reader/abc?slug=x&title=Frankenstein');
    expect(safeReturnPath('https://evil.example')).toBeNull();
    expect(safeReturnPath('//evil.example')).toBeNull();
    expect(safeReturnPath(42)).toBeNull();
  });
  it('builds the reader address with its public identity', () => {
    expect(readerReturnPath('id-1', 'shelley-frankenstein-en-orig', 'Frankenstein')).toBe('/reader/id-1?slug=shelley-frankenstein-en-orig&title=Frankenstein');
    expect(safeReturnPath(readerReturnPath('id-1', 'slug', 'A title with spaces'))).not.toBeNull();
    expect(readerReturnPath('id-1', undefined, undefined)).toBe('/reader/id-1');
  });
});
