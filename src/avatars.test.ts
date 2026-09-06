import { describe, expect, it } from 'vitest';

import { animalFromUrl, animals, avatarLetter, avatarUrlFor, schematics } from './avatars';

describe('avatars', () => {
  it('addresses the five animals by the web client URL', () => {
    expect(avatarUrlFor('fox', 'https://almonium.com')).toBe('https://almonium.com/assets/img/avatars/default/fox.png');
    expect(animalFromUrl('https://almonium.com/assets/img/avatars/default/stag.png?v=2')).toBe('stag');
    expect(animalFromUrl('https://storage.example/uploads/me.png')).toBeNull();
    expect(animalFromUrl(null)).toBeNull();
  });

  it('ships one schematic per animal', () => {
    expect(animals.every((animal) => schematics[animal].outline.startsWith('M'))).toBe(true);
  });

  it('takes the first letter or digit of the name', () => {
    expect(avatarLetter('kuzanoleg')).toBe('K');
    expect(avatarLetter('_7up')).toBe('7');
    expect(avatarLetter('')).toBe('·');
  });
});
