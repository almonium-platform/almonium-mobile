# Processor edition reader integration

2026-09-16: companions are identified by edition slug, not language. Book info's
variants carry editionSlug, editionType, cefrLevel and lineage; book and reader
choices label language + level + edition type. Reader settings allow same-language
companions. Parallel requests use `/public/books/{slug}/parallel-edition/{other}`
through the existing Firebase bearer client, with owner/primary/companion query
identity. No browser cookies or processor staff endpoints are used.

The WebView identifies primary/secondary spans by `data-side`. Inline and on-demand
reading preserve processor sentence groups; tapping a marked sentence highlights
all members of its group. Text selection takes priority. Errors retain the explicit
“Read without the companion” action. Downloaded base books do not invent a missing
edition slug or request a companion offline.

Verified: TypeScript, 91 Vitest tests, ESLint (existing generated `.expo` warning),
Android Expo export and browser execution of the WebView script for same-language
2:1 groups in both modes. This is not an on-device visual acceptance test.
Local package-bin shims report `Exec format error`; checks were run via Node:

```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/eslint/bin/eslint.js .
node node_modules/expo/bin/cli export --platform android --max-workers 2
```

Next: device tests of selection, dark mode, companion failure and offline reading;
consume the public chapter-enrichment endpoint; verify the fully published real
Frankenstein B2/original/Ukrainian trio. Publication remains a processor review
workflow and is not bypassed by this client.
