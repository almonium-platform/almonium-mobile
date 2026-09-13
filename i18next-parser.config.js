/**
 * `npm run i18n` walks every screen, component and module for `t('...')` and `msg('...')` and
 * writes the English catalogue, `src/locales/en.json`: the file to hand to a translator. The
 * English text is the key, so the value repeats it. Plurals are ICU inside the message, never
 * `_one` / `_other` keys.
 */
module.exports = {
  input: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}', '!src/**/*.test.ts', '!**/*.d.ts'],
  output: 'src/locales/$LOCALE.json',
  locales: ['en'],
  defaultNamespace: 'translation',
  defaultValue: (_locale, _namespace, key) => key,
  keySeparator: false,
  namespaceSeparator: false,
  pluralSeparator: false,
  contextSeparator: false,
  createOldCatalogs: false,
  keepRemoved: false,
  sort: true,
  indentation: 2,
  lexers: {
    ts: [{ lexer: 'JavascriptLexer', functions: ['t', 'msg'] }],
    tsx: [{ lexer: 'JsxLexer', functions: ['t', 'msg'] }],
    default: [{ lexer: 'JavascriptLexer', functions: ['t', 'msg'] }],
  },
};
