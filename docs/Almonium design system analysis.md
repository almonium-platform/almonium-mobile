<!-- Converted from Almonium design system analysis.pdf — 17 pages -->

## Page 1

A L M O N I U M · V I S U A L S Y S T E M E X T R A C T I O N
## the current interface
modal, Profi
fe
and the code disagree, both readings are recorded.
almonium-
## The implicit design system behind
Reconstructed from ten interface screenshots (login, onboarding step 3, avatar
le / Account / Learning settings, Play, Read index, Book detail,
Compare Plans) and cross-checked against the shipped stylesheets in
. No screen is proposed here; nothing is modernised. Where the screenshots

---

## Page 2

### © Visual character and product personality
The product reads as a warm, bookish, slightly whimsical study companion —
not a gamified streak machine and not an enterprise dashboard. Four traits carry
that character:
Paper-warm, never white. Every page sits on the same off-white cream; white
is reserved for raised cards. Visible on all ten screenshots. osservep --main-bg-
color: #F9F6F5
Literary serif voice. The wordmark, the top navigation and the game titles are set
in a serif/display face while UI controls are sans — the product signals "reading"
rather than "app". oBservep --font-family: Cambria.serif
Very round geometry. Pills, capsules and 20-35px card radii everywhere;
there is effectively no square corner in the product except the tiny CEFR/level
chip. oBservep
Playful, illustrated mascots. Cartoon animal avatars, a hand-drawn vintage-
engraving illustration set for games, drifting translucent card particles
behind auth/onboarding. Personality is delivered by illustration, not by UI
decoration. oBserveD
Plum/aubergine as the single brand hue, with raspberry as its action shade.
Nothing in the product uses a corporate blue except third-party auth and
informational accents. inrerreD
Copy tone matches: second person, short, warm, occasionally teasing ("Why so
mysterious? Share your interests with us!", "Almo will challenge your knowledge..."
"Who will outsmart the other to claim victory?"). Feature names are single verbs —
Discover, Review, Read, Play.

---

## Page 3

### © Page structure and navigation
Three distinct shells, each with a fixed anatomy. osserven
A - APP SHELL B - CENTRED HEADLESS
Sticky top bar, ~69px tall, cream (not No navbar. One card floated dead-
white), ending in a 1px hairline that is centre in the viewport over an
inset from both edges rather than full-animated particle field of pale pink/lilac
bleed. Left: circular white logo badge. rounded rectangles. Used for login and
Then serif nav links. Center: the target-for onboarding steps (there with a pill
language badge. Right, in fixed order: stepper above the card).
timer, chat, notifications, avatar. Login, Onboarding step 3
Play, Read, Book detail screenshots
C- MODAL / OVERLAY
Near-opaque dark scrim (#2b2b2b-ish,
high opacity — the page beneath is
visible but heavily dimmed), a cream
or light-grey sheet, a centred bold
title, and a grey circular X in the top-
right corner.
Change Avatar, Compare Plans
Two navigation levels only. Global sections live in the navbar; within a section, sub-
areas are centred underlined tabs (Settings: Profile - Account - Learning - App). There
is no sidebar anywhere. osserved
Active nav item = plum text (#520f6a) + 1px underline of the same colour. Inactive =
body grey. Hover = violet. osserven
Language switching is a persistent global control, not a setting: a small squared
badge showing the two-letter code, opening a vertical stack of same-shaped badges
directly beneath it. Each language gets its own generated colour (border + text), so
the badge is also a status indicator. osservep
Popovers, not pages, for avatar menu / notifications / timer: white, radius 25px, a
soft 0 4px 8px shadow, and a light pink 1px border. They are fixed at top: 6em and
anchored to the right edge. osservenp

---

## Page 4

Progress is shown as a numbered pill stepper on a white capsule: filled plum
circle + coloured label for the current step, grey circle + grey label for the rest; earlier
steps stay dark, indicating they are re-enterable. nrerreD
### o Layout,alignment,containers,spacing rhythmgrid,
One base container per page: full width, min-height = viewport - header, ~1.2rem
padding, cream background, contents centred. Section pages override it to top-align
and stack with a 2em gap. osserveD
Settings uses a masonry column layout, not a grid: a 820px-max, 2-column CSS
column flow with 1rem gutters and 400px blocks that avoid breaking. This is why the
Profile screenshot has cards of unequal heights stacking left and a taller Interests
card on the right with a ragged bottom edge. Below 820px it collapses to one
column. osservep
Catalogue pages use auto-fit grids of fixed-size cards, centred on small screens
and left-aligned from 600px up: games minmax(300px, max-content) with 280x400px
cards; books minmax(14rem, max-content) with 14remx22rem cards. Card margin
(10-20px) does most of the visual spacing; grid gap is only 6px. osserven
Detail pages are two-column and top-aligned: a fixed ~250px left rail (cover + one
full-width primary action) and a fluid right column of stacked facts, gap 2rem; it
stacks vertically under 768px. oBserveD
Spacing rhythm is rem-based and coarse: 0.2/0.5/1/1.5/ 2rem, with Trem as
the default gap inside a card and 2rem between major blocks. Onboarding cards
use padding 1.5rem and gap 2rem; settings blocks padding 1.3em and gap Tem.
There is no 4/8px token scale — spacing is authored per component. inrerren
Alignment convention: content left-aligned inside cards; card titles flush left at the
top; the row's action (edit pencil, chevron, toggle) pushed to the far right with
margin-left:auto . Modals and auth cards centre everything. wrerren
Onboarding cards are content-sized, min 20rem / max 30rem wide (40rem when
the step shows plans) — they never stretch to fill. osserven
The exact page max-width for Read / Play / Book is unknown — those grids are
full-bleed with only container padding, so on very wide monitors the behaviour
cannot be judged from a 1920px screenshot.

---

## Page 5

# © Typography hierarchy and type scale
# Three families coexist, each with a job: a serif for brand/reading surfaces, a UI
# sans (inherited from the component library) for controls and body, and Arial
# explicitly for the code-like language and level badges. osserven
| Role | Size | Weight | Where |
|---|---|---|---|
| Modal / plan display | (clamp ~48px 2rem) to | 700 | "Change "PREMIUM", Avatar", price "FREE", |
| Page / entity title | 2rem/ 32px | 550 | Book title, "Compare Plans" |
Nav link 1.8em 400 serif Discover / Review / Read / Play
(~29p%)
Card / step header 1.5rem / 600 "Choose Your Languages", game
24px titles
Sub-entity 1.4rem / 400 Book author (muted #555)
22px
Popover title 1.3rem 550 "Notifications"
Field label / body-L 1.17rem/ 550 "I'm fluent in”, "Level", danger
18px text
Body / control 16px 400-500 Default button label, book
description, filters
Settings card title 16px (13px bold "Profile", "Username", "Plan", "I
mobile) Know"
Small action 14-15px 550 Outline button, unlink, card meta
Caption / meta 0.7-400-550 Rating, year, notification time
0.85rem (#999)
Micro status 10px, 650 "VERIFIED", "LAST UPDATED"
uppercase
Inline chip text 0.55-550 "B2 - C1" inside a language chip
0.7rem,
trackinguppercase,+1px

---

## Page 6

550 is the house semibold. It appears far more often than 600 or 700 — an unusual
but consistent signature. oBserveD
Line-height is 1.5 for UI text and 1.6 for long-form reading (book description); titles
run 1.2-1.3. 0BSERVED
Title case for headings and buttons ("Choose Your Languages", "Continue Reading",
"Delete Account"); sentence case for helper text. inrerren
Uncertainty: the settings card titles are declared as the serif var(--font-family)
yet read as a bold sans in the screenshots; and the game card titles are set to the
browser keyword font-family: fantasy , which renders differently per OS. The
intended face in both places is unknown .
## © Colour roles
#FIF6F5 — every page, the navbar, the settings tab
Page ground strip, and the avatar modal sheet. Never used for a
raised element.
#FFFFFF — cards, popovers, the pill stepper, the
Raised surface filter "pad", plan cards, logo badge. White = "this
floats".
#3d3d3d — all body copy, and the border+label of
the outline ("black & white") button, which inverts to
a #3d3d3d fill on hover.
Primary text / neutral
action
Plum raspberry horizontal gradient on a full-width
Primary commit pill. Exactly one per view: "Continue", "Continue
Reading", "Save".
#83397f (with #520f6a for the active nav link,
Brand accent / focus #612b5e, #872657 for links). Fills the current step
circle, checkbox ticks, toggle track, avatar-edit fob.
Pale purple #958ba5 and lavender #A999A8 are the
## Hover/ de-emphasis
## hover states for accent things; violet #9A49D2 is the
hover for nav/icons.
Cyan — violet gradient, used only for paid status:
gradient text, gradient-outline "PREMIUM" button,
Premium the star badge, the Upgrade CTA, avatar ring. It is
deliberately outside the warm palette so it reads as
special.

---

## Page 7

#ffe3e9 zone background + #fa4666 text/border.
### O
### Destructive actions live in a dedicated pink "Danger
### Danger
### Zone" block at the bottom ofthe column, never
inline.
## 00 Success
## #16BA7Fstatusboxon("v#E7F8F2,VERIFIED").onlyasa small rounded
#f0ad4e on #f8f3e7 for awaiting states; #ea6644 for
Pending / warning "unverified, act now" (the verify button and its hover
fill).
Orange #ff7f00 is reserved for reading metadata:
### 8 Data highlight
### the CEFR range badge on a cover and the reading-
progress ring.
#e6e5e5 fill + #7e7e7e text, no border ("Current
Disabled Plan"). Text-appearance controls instead drop to
0.5-0.6 opacity.
#edebe8 for dividers and inactive borders; #eaeaea
Hairline inside popovers. Borders are always 1px and always
warm-grey — never black.
Interests, languages and CEFR chips get a pastel
### |
### | Generated identity colours huedata-drivenderivedandfromunbounded.their own label,Alwaysso thepastelpalette+ darkis
text.
Rule of thumb visible across all screens: colour encodes meaning, not decoration. A
screen has one cream ground, one white surface tier, one gradient CTA, and then
colour only where the data itself is categorical (language, interest, level) or the state is
exceptional (danger, success, pending, premium). INFERRED

---

## Page 8

## 0 Border, radius, shadow, elevation, surface
| RADIUS LADDER | TWO SHADOWS ONLY |
|---|---|
| 4px inline level chip - 8px discount badge | Ambient: 0 1px 3px rgba(e,0,0,.1), © |
| + 15-18px status box, filter pad, small pill + | 1px 2px -1px for cards, badges, the logo, |
| 20px settings block - 25px provider tile, | the avatar. Media: © 2px 5px 1px |
| popover, plan card - 25-35px generic | rgba(0,0,0,.15) for game and book |
| card - 50em / 9999px all buttons, chips | cards. Popovers get a third, deeper © 4px |
| and toggles. | 8px rgba(0,0,0,.15). |
| ELEVATION = SHADOW, NOT BORDER | FROSTED OVERLAYS |
|---|---|
| Raised things have a shadow and no | Text over artwork sits on |
| border. Bordered things (provider tiles, | rgba(255,255,255,.5) + backdrop- filter: |
| outline buttons, chips) are flat and | blur(6px) — book titles, the progress |
| interactive. The only element with both is | ring. Never a solid bar. |
the language badge and the popover.
| DASHED = EDITABLE / EMPTY | SETTINGS EXCEPTION |
|---|---|
| A 1px dashed border marks "add / edit / | Settings blocks deliberately kill the card |
| drop here": the Interests Edit chip, the "+ | shadow (box-shadow: unset) and |
| Order" chip, the file drop-zone. Solid | use radius 20px — the section reads |
| borders are committed values. | as floating flat panels cards. on cream rather than |
All of the above: oBservep in both screenshots and stylesheets.
## © Component patterns
Buttons — four appearances, no more
gradient bw (outline)
Full-width pill, plum — raspberry, white bold 1px #3d3d3d, transparent, 14px/550,
16px, padding 1.17rem 1.5rem, radius padding .5em Tem, pill. Hover inverts to dark
9999px. Hover = opacity .75. The single fill + white text. Secondary actions: Manage,
commit action. Link, Save.
underline text

---

## Page 9

| DASHED = EDITABLE / EMPTY | SETTINGS EXCEPTION |
|---|---|
| Underlined black label, no chrome; hover | Coloured label only ("Mark all as read"), |
| swaps the underline for a #f0f0f0 pill. | 16px/550, drops to opacity .5 when busy |
| Tertiary/toggling actions: Hide, Unlink. | or disabled. |
Danger is a fifth, page-specific variant: white fill, 1px #fa4666, radius 35px, padding 15px 30px,
bold 15px, icon + label, hover fills raspberry. oBSERVED
Icon buttons
A 40x40px circle, 1px #3d3d3d border, white fill, a 24px Lucide icon at stroke-width 1 inside;
hover inverts to a dark fill. Used for every "edit this row" affordance (Profile, Username,
Email, Password, I Know) and for "+ add". Bare Lucide icons (no circle) are used for
share/QR/link, bookmark and downgrade. Loading swaps the glyph for a centred spinner in
place. 0BSERVED
The icon set is mixed: Lucide (stroke, 1px) in the shell and settings rows, but Font Awesome solid
glyphs in the settings tabs and the numbered stepper avatars. OBSERVED
### Inputs
Pill-shaped fields (radius 2rem/3rem) with a white fill and a very soft shadow instead of a
visible border; label sits above the field in 1.1rem/550 ("I'm fluent in"). Multi-value fields hold
removable chips inline plus a trailing x (clear all) and v (open list). Search is a pill with a
leading magnifier and placeholder-only labelling. Selects are compact pills with a chevron,
sized to content (6-9rem). Focus/accent colour inside forms is overridden to a deeper plum
(#5A1A74); error state is #ac1c1c for both border and message. oBserveD
Cards — three distinct kinds
Settings/content panel: white, radius 20px, no shadow, padding 1.3em, gap 1em, bold
16px title flush top-left, one row of content, action right-aligned.
Media card: fixed size, radius 1.1-1.5rem, image bleeds to all four edges, metadata in a
frosted strip pinned to the bottom, status badges absolutely positioned in the corners
(level top-right, progress/parallel top-left), hover scale 1.01.
Illustrated game card: 280x400, radius 25px, a per-game pastel background colour
tinting both the illustration area (70%) and a slightly translucent caption area (30%),
centred display title + left-aligned 15px description in #666.
Note: the game card's description area is a fixed 30% and the copy is clipped rather than
truncated in the Play screenshot ("How far can you climb?" and "victory?" are cut off) — an
observed defect, not a rule. OBSERVED
### Tabs and segmented controls
Two different mechanisms, used consistently for two different jobs. Route tabs (Settings) are
centred, icon + label, transparent, with a plum underline under the active item and a full-
width hairline beneath the strip. Filter tabs (Play: All / Solo / PvP) are a white "pad" with
radius 18px holding pills; the active pill takes a pale pink fill (#ffeefb) with raspberry bold text

---

## Page 10

(#8F2356). Segmented switches (Monthly / Yearly) are a bordered radius-10px group where
the active half is white-raised and the inactive half is transparent, with a pink discount badge
riding the inactive label. oBserveD
### Chips and badges
Data chip (interest, language, level): pill, auto-generated pastel fill, dark text, no border,
0.5em gaps in a wrapping row. A chip may nest a micro "inner-text" box (1px solid, radius
4px, 0.55rem uppercase) for a level range.
Action chip: same pill but transparent with a 1px dashed #3d3d3d border and a small
leading icon — Edit, Add, + Order.
Squared badge (.badge-btn): radius 25%, Arial, +1px tracking, 1px coloured border,
shadow, cream fill — the navbar language code and the CEFR level. Hover scale 1.02.
Status box: radius 15px, tinted background, tiny circular glyph + 10px/650 uppercase label
(VERIFIED, pending).
Corner badge: solid orange pill, white bold 14px, radius 20px, absolutely positioned on
artwork (level range on covers).
Notification dot: tiny red dot pinned 2px/2px inside the top-right of the host icon
or avatar.
Premium star: 2.5rem gradient circle with a glow shadow, pulsing on hover.
Menus
White popover, radius 25px, pink hairline border, 0.5rem vertical padding, 20rem-wide rows.
Row = 24px Lucide icon + label, radius-md, hover #f3f4f6. Groups are separated by a 1px
#eaeaea rule; the profile menu leads with an avatar + username/email identity block. Right-
click context menus on notifications use the same row grammar, with destructive items in
raspberry. Menu bodies scroll at max-height 60vh with a custom 8px scrollbar. oBserveD
Modals
Radius 2rem sheet, min-width min(50rem, 60vw) for wide ones, background cream (Change
Avatar) or light grey #f1f1f1 (Compare Plans) so that white content cards read as raised inside
it. Header: centred, bold, clamp(1rem, 7vw, 2rem), Trem padding, 2rem margin below. Close =
grey circular X top-right. Bodies split into a narrow left "current value" column and a wider
right "choose" column separated by a 1px vertical divider with 1rem breathing room; below
780px the split becomes vertical and the divider becomes horizontal. Confirmations are a
separate title + message + confirm-text modal, sometimes with a countdown before the
destructive button arms. oBserveD

---

## Page 11

# © Information-density conventions
One concern per card. Settings never groups two unrelated fields; "Email and
Password" is one card because they are one concern, and Level/Active sit in one card
because both belong to the selected language. osserven
Loose overall, dense at the atom. Generous card padding and whitespace, but the
atoms themselves are tight: 10px uppercase micro-labels, 0.7rem ratings, chips
packed at 0.5em. inFERRED
Facts are compressed onto one line with - separators rather than a definition list:
# "English B2-C1 + 255 pages- First published in 1872 - Translated by Anthony
Matonak". osservep
# Overflow is summarised, not scrolled: "+1 more" next to a language chip; a filter
row rather than a table of options. osservep
Explanations are deferred to tooltips and (i) buttons, keeping the surface short;
only genuinely constraining rules are printed inline ("Free plan lets you pick only 1
target language."). inFERRED
Catalogues are cover-first: ~86% of a book card is artwork; text is minimal and
overlaid. Density scales by adding cards, never by shrinking a card. oeserven

---

## Page 12

### © Repeated interaction patterns
Read-then-edit rows. A value is displayed, and a circular pencil on the far right
switches that row into edit mode in place. Saving is a "bw" Save button inside the
same card. osservep (Username, I Know, Interests)
Inline optimistic actions with local spinners. Any icon or button can carry its own
loading state — the glyph is replaced by a spinner and the label is made
transparent, so layout never shifts. osserven
Hover-swapped labels. The same control changes its word on hover to reveal the
inverse action (Hidden - Unhide). osservep
Micro-scale on hover — 1.01-1.09 depending on element size (cards 1.01, badges
1.02, menu icons 1.05, avatars 1.09) with a 0.2s ease. Nothing lifts or changes
shadow. osserveD
Dismiss by clicking outside. Every popover and dropdown closes on outside click;
dropdowns also support arrow-key navigation with a focused-item style. osserven
Destructive actions are always two-step and always physically separated
into a pink Danger Zone; a confirmation modal (sometimes countdown-gated)
follows. oBserveD
Paywall as an interception. Locked capability is not hidden; it is shown with the
constraint stated, and the Upgrade CTA opens the Compare Plans modal. Premium
features are marked with + /gradient rather than a lock. rerren
Filters are a single horizontal row of heterogeneous controls (search, radio, select,
sort direction) that collapses to a column under 768px; results react immediately,
with no Apply button. inrerren
Whether card hovers reveal extra affordances (the book caption strip has an
opacity/transform transition defined) is unknown from static frames.

---

## Page 13

### @ State
State
Primary
Secondary
Selected
Disabled
Empty
Loading
Error
Pending
How it appears
One gradient pill, full width of its container, bottom of the card
or under the cover. Never two per view.
Outline pill or circular icon button; sized to content, right-
aligned.
Three dialects: plum underline (route tabs), pale-pink fill +
raspberry bold text (filter pills), white raised half (segmented).
For chips, selection = having the coloured fill at all; for the
language badge, a coloured border + larger type.
#e6e5es fill, #7e7e7e text, matching border, cursor:not-allowed
("Current Plan"). Gradient buttons instead stay coloured at
opacity .75; text buttons at .5; disabled icons at .5 with hover
suppressed. Future steps in the stepper use grey circle + grey
label.
A dashed "+ Add" chip plus one warm sentence of copy — "Why
so mysterious? Share your interests with us!" Menus use a plain
centred line ("You have no notifications."); catalogues use a
1.2rem padded message. No illustrations in empty states.
Two tiers. In-control: absolutely centred spinner with the
content hidden in place. Page-level: skeletons that mirror the
real layout — radius-12px blocks at 60% / 40% / 15% widths for
title / author / rating, then 16px description lines with a shorter
last line.
Field-level only in the evidence: #ac1c1c border and message
under a pill input. Destructive/irreversible framing uses the
raspberry danger palette. A global toast/banner pattern is
unknown — none of the ten screenshots shows one.
Amber: #f8f3e7 box with #f0ad4e glyph and label, or a circular
amber-outlined icon that fills amber on hover.
### language

---

## Page 14

@ Reusable components (inventory)
components. OBSERVED
App navbar (+ mobile popover) Target-language badge + dropdown
Avatar(size, premiumring, editfob) * Notificationpopover+tem Settingstabs
Section block/ card Button (4 appearances, loading, hint)
Actionicon(circular, self-loading) Editbutton Info0)button +tooltip
| Status CEFR badge box (verified Language / pending) chip / selector Confirm modal Interest (+ countdown) chip grid |  |  | Danger zone |
|---|---|---|---|
| Paywall / Compare Plans | Premium badge + gradient text | Interactive CTA button |  |
| * File upload dropzone | Media card + corner badges | Filter row / filter pad |  |
| Social auth buttons | Share link / QR Skeleton set Divider Particle (1px, background Trem margins) |  |  |

---

## Page 15

C O N S T I T U T I O N

---

## Page 16

### Rules every future Almonium screen follows
1 Cream ground, white float. Every page starts on #F9F6F5. White is only for
raised surfaces. Never put a white page background behind content.
2 One primary action per view, and it is the plum→raspberry gradient pill
(radius 9999px, white bold 16px, padding 1.1rem 1.5rem), full width of its
column. Everything else is outline, underline or text.
3 Round everything. Interactive elements are pills; containers are 20–35px;
nothing below 15px except the 4px inline level chip and 8px micro-badges.
No square corners.
4 Serif for brand and reading, sans for controls, Arial-style caps for codes.
Never set a form label or button in the serif; never set the wordmark or a
nav link in the sans.
5 550 for emphasis, 700 only for display. Body 16px/1.5, long-form 1.6,
micro-labels 10px uppercase 650 with tracking.
6 One concern per card, bold 16px title flush top-left, content in a single row
or wrapping chip row, the row's action pushed to the far right as a 40px
circular outlined icon.
7 Spacing in rem steps of 0.5: 0.5 / 1 / 1.5 / 2rem. 1rem gap inside a card,
1.3em card padding, 2rem between blocks. Use flex/grid gap, never
margins between siblings.
8 Elevation is shadow, hierarchy is not border. Two shadows only: ambient
for cards, the slightly deeper media shadow for artwork. Hover changes
scale (1.01–1.09), never shadow.
9 Categorical data is a pastel chip whose colour comes from its own label
— languages, interests, levels. Do not hand-pick chip colours, and do not
invent new semantic hues.

---

## Page 17

10 Dashed border = "add / edit / drop here". Solid = a committed value. Keep
that contract.
11 Edit in place. Show the value, offer a pencil, swap the row into a field, save
within the same card. No separate edit pages.
12 Every control owns its own loading state — spinner in place, label hidden,
zero layout shift. Page-level waits use skeletons shaped like the real content,
radius 12px.
13 Destructive actions are quarantined in a #ffe3e9 Danger Zone at the end
of the column, with a raspberry outline button and a confirmation step.
Never inline, never a primary.
14 Premium is the cyan→violet gradient and nothing else. Locked features
stay visible with the limit stated in one plain sentence; upgrade is an
invitation, not a lock icon.
15 Personality comes from illustration and copy, not from UI ornament.
Mascots, engraved artwork, particles and a warm second-person voice —
while the chrome stays quiet, round and cream.
Extraction only — no new screens, no recolouring, no simplification. Discover, Review and chat were not supplied and are absent from this analysis.