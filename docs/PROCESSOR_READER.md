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

## Chapter page on the phone (2026-09-16, redesign J8–J11)

The reader now follows the mobile section of the Chapters redesign. The chrome is
two floating bars: the back-chevron header with the book title, the chapter being
read and the 3px position bar on top; Contents and Words pills with Aa on a bottom
row. Both leave on a scroll down and return on a scroll up, or on any chapter jump.
The WebView reports the chapter holding the viewport (`position` messages), and
the page gets body padding and `scroll-margin-top` so a jump lands under the bar.

Each chapter with a complete estimate gets its header under the heading: a mono
"Chapter n of N · Estimated X" line and the descriptions as one paragraph.
Titles display as "Chapter V" rather than "CHAPTER V." in the rails and headers
only; anchors and the text keep the source form.

**Contents sheet (J9):** title plus two-letter level per row, the description only
on the current chapter (raised card, scrolled into view on opening) or on a row
tapped once; a second tap goes. Rows without a description go on the first tap.
The subtitle is the chapter count and the B1–C1 range over estimated chapters.

**Words sheet (J10):** the chapter being read, with ‹ › moving the list between
processor chapters without moving the text. Rows show the lemma, the observed
form only when it differs, the excerpt with the form tinted, and "Saved" for
lemmas already in review. A tap swaps the same sheet to the word card with
"← Words" at the top; closing returns to the reader. Pending/stale is one grey
line; an `unavailable` list hides the Words pill instead of disabling it.

**Chapter end (J11, member form):** when the chapter being read has answered
its vocabulary request, the WebView gets a block before the next heading: the
first three words with "All N words" expanding in place, then the next chapter
as a full-width row with its level and description. A row tap opens the same
Words sheet on that word; the next row scrolls locally. The guest chrome,
account panel and "Read free" states do not apply: this client requires a
signed-in account to open the reader.

Checks: TypeScript, 110 Vitest tests, ESLint (only the generated `.expo`
warning), Android export, and the Chromium fixture check of the WebView scripts:

```bash
node scripts/check-reader-chrome.mjs
```

It verifies position/chrome reports, the chapter jump, escaped header injection,
chapter-end rows, folding, the word-tap message and the next-chapter jump. It
needs no backend. Native sheet layout, the chrome animation, pressed and night
states on a device still need acceptance.

## Reading without an account (2026-09-16, redesign J6–J8, J11 guest forms)

The reader, the book page and a library open without signing in. Everything
reads; only keeping needs an account, so the account ask sits where keeping
would happen and nowhere else: the save slot of the word card and the chapter
end. Never on arrival, never as a modal.

- **Entry.** The sign-in screen links to `/read`, the public library: every
  published edition from `GET /public/books`, grouped by language. Book cards
  carry `editionSlug` as a `slug` param; the guest lane addresses books by it.
- **Book page.** A guest loads `GET /public/books/{slug}`. The native header
  keeps back navigation and shows Sign in / Read free on the right. Favorite,
  offline download and translation orders are absent, not disabled; the
  parallel row lists existing companions and a dashed "Request a translation"
  chip that opens sign-in and returns here.
- **Reader.** Text, companions, chapters and vocabulary come from the public
  slug endpoints without a token. The top chrome is the public navbar with a
  back chevron: wordmark, Sign in, Read free, with the 3px position bar under
  it. The word card keeps every sense; the intents and audio go, and the save
  slot becomes "Save to review — free account" (or "Write a meaning — free
  account" without a sense) with "Keep 100 words, no card required. Sign in"
  under it. The chapter end reports its visibility from the WebView; while it
  is on screen the bottom row becomes the pinned panel: "Your place is kept on
  this phone…", Read free, and "Continue to <next chapter>". The Words sheet
  has no Saved marks. The card's other language is the phone's language when it
  differs from the book's.
- **Position.** A guest's place is stored on the device under
  `almonium:guest-progress:{slug}` and restored on opening; nothing is synced
  and no activity is reported.
- **Return.** Sign in and Read free carry a `returnTo` in-app path (validated by
  `safeReturnPath`). After sign-in the index route sends a completed account
  back to it, so a guest lands on the same book. Returning to the exact word,
  and saving it without a second tap, is not implemented: the reader reopens
  at the kept place with the word sheet closed.

No backend change: the public controllers already served these routes by
slug. The chapter and vocabulary calls now use the tokenless client, which the
backend treats the same. The Chromium fixture check also asserts the
chapter-end visibility messages. Native acceptance still pending: the guest
header over the WebView, the pinned panel's appearance and leave, and the
sign-in return on a device.

## The library is the front door (2026-09-17, Mobile Guest K1–K6)

The guest lane now follows the "Almonium Mobile - Guest" page rather than the
sign-in-first order of the day before.

- **Entry.** A cold open without a session lands on `/read`; the tabs group
  and the index route send a guest there too. The sign-in route stays for
  password reset, deep links and OAuth, and keeps its "Browse the library"
  link as the way back out. Sign-in everywhere else is a sheet.
- **Library (K1, K2).** Public navbar with the design's wordmark (drawn with
  `react-native-svg`), one line of promise and one of proof, a horizontal
  language chip filter (default: the phone's language when the list has it,
  else the language with most editions), and book rows with cover, title,
  author, the editorial level as the only badge and "Parallel text" when a
  companion exists. The public list has no chapter count, so none is shown.
  When the device holds a position, the promise gives way to one dark Continue
  card for the most recent book (title, chapter, percentage, bar), and that
  book leaves the list. The card comes from `almonium:guest-last-read`, which
  the reader writes alongside the percentage.
- **Book page (K3).** As before, plus the J1 contents under the parallel row:
  number, title, one line of description and the estimate in mono, eight rows
  then "All N chapters" in place. Titles come from the public chapter
  projection, which now carries `title`. A row opens the reader with a
  `chapter` sequence that is jumped to once the headings are known. The
  primary button reads "Continue reading" when the device holds a position.
  The request chip opens the auth sheet with "Ask for {Book} in {Language}".
- **Auth sheet (K5).** One sheet over the current screen: eyebrow, a title
  that says why it opened ("Keep {word} and your place in {Book}", "Keep your
  place in {Book}", "Ask for {Book} in {Language}", "Welcome back"), Apple and
  Google above, then email and password with a single toggle line between
  sign in and create account. The one-email-field flow with a code waits on an
  exists-check endpoint, as the page allows. The screen behind stays; the word
  sheet hides while the auth sheet is up and returns with its state.
- **Completed action (K4).** In the reader the pending action runs once the
  account exists: "Save to review — free account" keeps the word and the word
  sheet shows Kept without a second tap. The device position is carried into
  the account (recorded and flushed) instead of the server's zero, and the
  text does not reload because published text is fetched by slug for guests
  and members alike. Creating an account still needs email verification
  first, so that path ends in the sign-in step with a notice.

Checks: TypeScript, ESLint (only the generated `.expo` warning), 114 Vitest
tests, Android export and the Chromium fixture check. Device acceptance
pending: the auth sheet over the reader, the sheet swap on save, the carried
position after sign-in, and the library's Continue card.
