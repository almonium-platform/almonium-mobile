import { describe, expect, it } from 'vitest';

import { pseudo } from './i18n-pseudo.mjs';

describe('pseudo', () => {
  it('accents, stretches and brackets plain copy', () => {
    expect(pseudo('Settings')).toBe('[Šéţţîñĝš~~~~~~]');
    expect(pseudo('OK')).toBe('[ÖĶ~~]');
  });

  it('leaves ICU placeholders alone and stretches only plural bodies', () => {
    expect(pseudo('Hello {name}')).toBe('[Ĥéĺĺö {name}~~~~~]');
    expect(pseudo('{count, plural, one {# book} other {# books}}')).toBe('[{count, plural, one {# ƀööķ} other {# ƀööķš}}~~~~~~~]');
  });
});
