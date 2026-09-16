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

Verified: TypeScript, 96 Vitest tests, ESLint (existing generated `.expo` warning),
Android Expo export and browser execution of the WebView script for same-language
2:1 groups in both modes. This is not an on-device visual acceptance test.
Local package-bin shims report `Exec format error`; checks were run via Node:

```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/eslint/bin/eslint.js .
node node_modules/expo/bin/cli export --platform android --max-workers 2
```

## Chapter navigation and honest companions

The reader header now has a chapter-list button. It discovers headings in the
loaded WebView and jumps locally, including downloaded books. Processor anchors
join optional `/public/books/{editionSlug}/chapters` enrichment by sequence, never
array position. Only complete estimates/descriptions appear. An unavailable
enrichment request does not block navigation or text; malformed optional rows are
ignored. Companion headings are excluded, including in same-language pairs.

Adaptations include translations of other editions by default, with an On/Off
switch and explicit provenance wording. Hiding an active indirect translation
returns to single-edition mode. The product owner can reconsider this default;
it is not a claim that a translation of the original has the adaptation's level.
Mode labels say “this edition” and “companion,” not “original” and “translation.”

Browser execution of the chapter bridge passed in single, inline and on-demand
layouts, excluding duplicate secondary headings. A read-only live-backend check
found all 30 original Frankenstein chapters, joined Chapter V enrichment and
jumped correctly. Android export passes. Native sheet layout, pressed/dark states,
selection and physical-device navigation still need acceptance on a device.

Next: device tests of selection, dark mode, companion failure and offline reading;
verify the fully published real
Frankenstein B2/original/Ukrainian trio. Publication remains a processor review
workflow and is not bypassed by this client.

## Chapter vocabulary (2026-09-16)

On an updated mobile build, open the published original Frankenstein, tap the
header's chapter-list button, then **Vocabulary** under **CHAPTER V.** Expect 21
curated entries including `countenance` and `endeavour` / `endeavoured`. Each row
shows the actual source excerpt. **Look up** opens the existing in-reader word
sheet, with book/chapter attribution, the excerpt and English lookup language.
**Back to vocabulary** returns to the list; dismissing the sheet preserves reading
position. A different learner language does not override the book's language.

The lazy, owner/edition/chapter-keyed request uses the existing Firebase bearer
client: `GET /public/books/{slug}/chapters/{sequence}/vocabulary`. The sequence
comes from the processor heading anchor, never its list position or title. The
client consumes the existing typed contract, not a new NLP or AI stage. Only
ready, source-attested examples display; this is not an exhaustive word list.
Old headings without processor IDs, editions without slugs, missing/stale
artifacts, failed requests and paused offline requests keep chapter navigation
and base reading available. Vocabulary revalidates on opening; failed/offline
refreshes do not present cached examples as freshly verified. Word lookup also
has an explicit paused/offline message rather than an empty sheet.

Checks for this slice: TypeScript, 103 Vitest tests, ESLint (only the existing
generated `.expo` warning) and Android export. The tests exercise contract
validation, source context/language and loading/empty/stale/error/offline states;
they do not mount the native reader. Android export is a build, not an installation.

Re-run the read-only WebView check with the local backend running:

```bash
node scripts/check-reader-vocabulary.mjs
```

It uses Chromium from the sibling web checkout, tests primary-only chapter
navigation in three fixture layouts, and checks the real original's 30 headings,
Chapter V jump and vocabulary-to-lookup context. It never requests a generated
definition or publishes anything. Native bottom-sheet transitions, pressed/dark
states, real offline mode and saving the looked-up word still need device
acceptance. Book/chapter attribution is retained in the lookup visit; this slice
does not add persistent source-edition fields to saved cards.
