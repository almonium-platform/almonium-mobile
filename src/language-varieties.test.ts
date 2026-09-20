import {describe, expect, it} from 'vitest';
import {languageVarieties, selectedVariety, onboardingLanguageUpdates} from './language-varieties';

describe('learning varieties', () => {
  it('preserves a stored choice and defaults within the selected language', () => {
    expect(selectedVariety('DE', 'de-CH')?.tag).toBe('de-CH');
    expect(selectedVariety('DE', 'en-GB')?.tag).toBe('de-DE');
    expect(selectedVariety('EN')?.tag).toBe('en-US');
    expect(selectedVariety('IT', 'it-IT')).toBeUndefined();
  });
  it('has unique tags belonging to their language and no voice IDs', () => {
    const tags = Object.values(languageVarieties).flat().map(v => v.tag);
    expect(new Set(tags).size).toBe(tags.length);
    for (const [language, varieties] of Object.entries(languageVarieties)) {
      expect(varieties.every(v => v.tag.toUpperCase().startsWith(language + '-'))).toBe(true);
    }
  });
});

it('submits every onboarding language without overwriting unedited choices', () => {
  const learners = [
    {id: 'en', language: 'EN', selfReportedLevel: 'B2' as const, variety: 'en-GB', active: true},
    {id: 'de', language: 'DE', selfReportedLevel: 'A2' as const, variety: 'de-CH', active: true},
  ];
  expect(onboardingLanguageUpdates(learners, {DE: 'B1'}, {EN: 'en-AU'})).toEqual([
    {language: 'EN', cefrLevel: 'B2', variety: 'en-AU'},
    {language: 'DE', cefrLevel: 'B1', variety: 'de-CH'},
  ]);
});
