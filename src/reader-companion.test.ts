import { describe, expect, it, vi } from 'vitest';

import { editionCode, editionName, editionTypeLabel, loadCompanionChoice, noCompanion, saveCompanionChoice } from './reader-companion';
import { parallelModeScript, parallelScript } from './reader-parallel';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
  },
}));

const primary = { id: 'a', language: 'EN', editionSlug: 'frankenstein-en-b2', editionType: 'adaptation', cefrLevel: 'B2' as const };

describe('companion choice', () => {
  it('is remembered per book, including the choice of none', async () => {
    expect(await loadCompanionChoice('book-1')).toBeNull();
    await saveCompanionChoice('book-1', 'frankenstein-uk-c1');
    await saveCompanionChoice('book-2', noCompanion);
    expect(await loadCompanionChoice('book-1')).toBe('frankenstein-uk-c1');
    expect(await loadCompanionChoice('book-2')).toBe('none');
  });

  it('writes the header codes and the sheet rows', () => {
    const companion = { id: 'b', language: 'UK', editionSlug: 'frankenstein-uk-c1', editionType: 'machine_translation', cefrLevel: 'C1' as const, sourceEditionSlug: 'frankenstein-en-b2' };
    expect(editionCode(primary)).toBe('EN B2');
    expect(editionCode({ id: 'c', language: 'de' })).toBe('DE');
    expect(editionCode(undefined)).toBe('');
    expect(editionName(companion)).toBe('Ukrainian · C1');
    expect(editionTypeLabel(companion, primary)).toBe('Machine translation');
    expect(editionTypeLabel({ ...companion, sourceEditionSlug: 'frankenstein-en-original' }, primary)).toBe('Translation of the original');
    expect(editionTypeLabel({ ...companion, editionType: 'human_translation' }, primary)).toBe('Translation');
    expect(editionTypeLabel({ id: 'd', language: 'EN', editionType: 'original' })).toBe('Original');
    expect(editionTypeLabel({ id: 'e', language: 'EN', editionType: 'graded_reader' })).toBe('graded reader');
  });
});

describe('parallel runtime', () => {
  it('is absent without a companion and switches mode in place', () => {
    expect(parallelScript('UK', 'off')).toBe('');
    expect(parallelModeScript('off')).toBe('true;');
    expect(parallelScript('uk', 'on-demand')).toContain('var fluent = "UK"');
    expect(parallelScript('uk', 'inline', true)).toContain('var reduceMotion = true');
    expect(parallelModeScript('inline')).toContain('setMode("inline")');
  });
});
