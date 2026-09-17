import { describe, expect, it } from 'vitest';
import { chooseCompanion, companionEditions, editionLabel, isOtherEditionTranslation, parallelEditionPath } from './reader-editions';
import { parallelScript } from './reader-parallel';
import type { BookEditionVariant } from './types';

const original: BookEditionVariant = {id: 'one', editionSlug: 'original', language: 'EN', cefrLevel: 'C1', editionType: 'original'};
const adapted: BookEditionVariant = {id: 'two', editionSlug: 'b2', language: 'EN', cefrLevel: 'B2', editionType: 'adaptation'};
const ukrainian: BookEditionVariant = {id: 'three', editionSlug: 'uk', language: 'UK', cefrLevel: 'C1', editionType: 'machine_translation'};

describe('edition-addressed reading', () => {
  it('distinguishes original-derived translations from ones made for the adaptation', () => {
    const inherited = {...ukrainian, sourceEditionSlug: 'original'};
    const direct = {...ukrainian, sourceEditionSlug: 'b2'};
    expect(isOtherEditionTranslation(inherited, adapted)).toBe(true);
    expect(isOtherEditionTranslation(direct, adapted)).toBe(false);
    expect(isOtherEditionTranslation(original, adapted)).toBe(false);
    expect(isOtherEditionTranslation(inherited, original)).toBe(false);
    expect(editionLabel(inherited, adapted)).toContain('not this adaptation');
    expect(editionLabel(direct, adapted)).not.toContain('not this adaptation');
  });
  it('offers only other-language editions as companions; same-language ones belong to the book page', () => {
    expect(companionEditions([original, adapted, ukrainian], 'two')).toEqual([ukrainian]);
    expect(chooseCompanion([original, adapted, ukrainian], 'two', 'original', ['UK'])).toEqual(ukrainian);
    expect(chooseCompanion([original, adapted, ukrainian], 'two', undefined, ['UK'])).toEqual(ukrainian);
    expect(chooseCompanion([original, adapted, ukrainian], 'two', undefined, [])).toBeUndefined();
  });
  it('keeps downloaded-only metadata readable without inventing a companion slug', () => {
    expect(companionEditions([{id: 'one', language: 'EN'}], 'one')).toEqual([]);
  });
  it('labels edition identity and encodes the request path', () => {
    expect(editionLabel(adapted)).toBe('EN · B2 · adaptation');
    expect(parallelEditionPath('book one', 'en/b2')).toBe('/public/books/book%20one/parallel-edition/en%2Fb2');
  });
  it('disables enhancement in single mode and safely quotes language input', () => {
    expect(parallelScript('EN', 'off')).toBe('');
    expect(() => new Function(parallelScript("en';throw Error('oops');//", 'on-demand'))).not.toThrow();
    expect(parallelScript('EN', 'inline')).toContain("side === 'secondary'");
  });
});
