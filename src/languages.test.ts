import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { languageName, sortLanguages } from './languages';

const backendEnum = resolve(
  __dirname,
  '../../almonium-be/src/main/java/com/almonium/analyzer/translator/model/enums/Language.java',
);

function backendCodes(): string[] | null {
  try {
    const source = readFileSync(backendEnum, 'utf8');
    const body = source.slice(source.indexOf('{') + 1, source.lastIndexOf('}'));
    return body
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim().replace(/,$/, ''))
      .filter((token) => /^[A-Z]{2,3}$/.test(token));
  } catch {
    return null;
  }
}

describe('languages', () => {
  it('uses friendly names and safely falls back to the code', () => {
    expect(languageName('DE')).toBe('German');
    expect(languageName('BHO')).toBe('Bhojpuri');
    expect(languageName('CKB')).toBe('Kurdish (Sorani)');
    expect(languageName('XX')).toBe('XX');
    expect(languageName('')).toBe('');
  });

  it('tolerates lowercase and region-tagged codes', () => {
    expect(languageName('pt')).toBe('Portuguese');
    expect(languageName('pt-BR')).toBe('Portuguese');
    expect(languageName('zh_TW')).toBe('Chinese');
  });

  it('names every code the backend Language enum defines', () => {
    const codes = backendCodes();
    if (!codes) return; // sibling repo not checked out on this machine
    expect(codes.length).toBeGreaterThan(100);
    const unnamed = codes.filter((code) => languageName(code) === code);
    expect(unnamed).toEqual([]);
  });

  it('sorts by display name without mutating the API response', () => {
    const input = ['ES', 'DE', 'EN'];
    expect(sortLanguages(input)).toEqual(['EN', 'DE', 'ES']);
    expect(input).toEqual(['ES', 'DE', 'EN']);
  });
});
