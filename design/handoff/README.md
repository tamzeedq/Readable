# Handoff: Readable — desktop speed-reading app (Paper direction)

## Overview
Readable is a desktop RSVP (rapid serial visual presentation) reader. Users import EPUB/PDF/TXT files or paste text, organise books into shelves and smart lists, and read one word at a time at a chosen speed (wpm) with an optimal-recognition-point "focal letter" highlighted. Everything is local-first ("Files stay on this device"); account/sync is marked "Soon".

Two colour palettes were approved, each with light and dark modes:
- **1a · Sepia** — cream paper, rust accent and focal letter
- **2a · Moss** — green parchment, deep moss accent, sage in dark

Layout, type and components are identical across palettes; only the CSS custom properties change.

## About the design files
The files in this bundle are **design references built in HTML**: prototypes showing the intended look and behaviour. They are not production code to copy. Recreate them in the target codebase's environment (React, Vue, SwiftUI, Electron/Tauri, etc.) using its established patterns. If no environment exists yet, pick an appropriate desktop stack (e.g. Tauri or Electron + React + TypeScript) and implement there.

The `.dc.html` files use a small in-house template runtime (`support.js`, `{{ }}` holes, `<sc-if>`, `<sc-for>`). Treat that syntax as pseudo-JSX: `<sc-if value="{{ x }}">` = `{x && …}`, `<sc-for list="{{ items }}" as="b">` = `items.map(b => …)`. Logic lives in the `class Component` at the bottom of `Readable Paper.dc.html` — read it for exact behaviour.

Open `Readable Paper Screens.dc.html` in a browser (served over http, next to `support.js`) to see all 12 screens × 2 palettes × light/dark, for desktop and mobile. Every frame is live and clickable.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, copy and interactions. Recreate pixel-accurately. Design frame is **1280 × 800**; the app should be fluid above that (main content flexes, sidebar fixed).

---

## Global layout
- Root: `display:flex; height:100%; overflow:hidden; background:var(--bg); color:var(--ink); font-family:var(--ui)`.
- **Sidebar** (all screens except Reader): width 236px, `background:var(--sidebar)`, `border-right:1px solid var(--line)`, padding `22px 14px 14px`, vertical flex gap 22px.
  - Wordmark "Readable" — Newsreader 25px/600, letter-spacing −0.015em, + collapse-sidebar icon button 36×36.
  - Search button: height 40, radius 8, `var(--surface)` bg, 1px `var(--line)` border, muted 15px text "Search", `⌘K` kbd (12px, 1px `--line-strong` border, radius 4). Opens Search overlay.
  - Main nav (gap 2): Home, Library, Collections, Stats, Settings. Each 38px tall, radius 8, padding 0 10, gap 12, 16px, 19px stroke icons (1.6 stroke). Active item bg `var(--chip)`.
  - "Shelves" group: italic 14px muted header + "New shelf" (+) 28×28 button. Rows 34px, 15px: colour tab (8×12, radius 1) · name · count (13px muted). Fiction 6 `oklch(0.5 0.08 20)`, Work 2 `oklch(0.5 0.08 250)`, To read 4 `oklch(0.5 0.08 140)`.
  - "Smart lists": Recently added 3 (clock), In progress 6 (play-circle), Finished 2 (check-circle).
  - Footer (margin-top:auto, border-top `--line`, padding 10): person icon · "Account & sync" · italic 12px "Soon". Muted 14px.
- Main content: `flex:1; padding:32px 44px` (Home 36px 48px).
- Page title pattern: H1 Newsreader 36px/500, letter-spacing −0.015em, with italic 16px muted meta beside it (baseline-aligned, gap 14).

## Screens

### 01 Home
- Header: italic 15px muted date ("Friday, 9 October") above H1 "Good evening" (38px/500, lh 1.1). Right: secondary button "Paste text" (clipboard icon) and primary "Add books" (+). Buttons 42px tall, radius 8, 15px.
- **Continue reading card**: grid `156px | 1fr | auto`, gap 36, padding `30px 36px 30px 30px`, `--surface`, 1px `--line`, radius 12, `--shadow`.
  - Cover 156×234, radius `3px 7px 7px 3px`, bg `--hero-cover`, inner 1px border inset 10px rgba(246,239,226,.45), title Newsreader 23px, author 10px uppercase tracking .16em, spine gradient 12px on left. Text colour #f6efe2.
  - Middle: eyebrow "CONTINUE READING" 13px uppercase .16em `--accent-text`; H2 "Middlemarch" 42px/500 lh 1.05; italic 18px author; 16px "Chapter 38 · resume at *"…by the side of provincial fashion…"*"; buttons "Resume" (primary, play icon, 44px, 16px) and "Details" (secondary → Book details drawer).
  - Right column (left border `--line`, padding-left 36): 112px progress ring (r 48, stroke 5, track `--line-strong`, arc `--accent`, round cap, starts at 12 o'clock), centre "38%" Newsreader 28px; "10 h 12 m left" 16px; italic 14px muted "at 320 wpm".
- **Recently read**: italic H2 24px + "View library" link (15px muted). 6-col grid, gap 24. Book tile: 2:3 cover (radius `2px 5px 5px 2px`, `--book-shadow`), title Newsreader 15px/500 ellipsis, 3px progress bar + 12px status ("38%", "Finished", "Unread").

### 02 Library
- Header: "Library" + italic "10 books"; right: search field (260×42, "Search title, author, tag") and primary "Add books".
- Filter bar (border-bottom `--line`, padding-bottom 18): segmented control Status (All / Unread / In progress / Finished) — container `--chip`, padding 3, radius 9; segments 32px, radius 7, active = `--surface` + `--shadow`. Dropdown buttons Format, Shelf, Tag (38px, chevron). Right: sort "Recent" + view segmented (Grid / List / Compact icon buttons 34×32).
- Grid: 6 cols, gap `26px 24px`. Tile = cover + title (15px) + italic 13px author + progress row + meta row (format badge 10px tracking .08em, 1px border radius 3 · last read).
- **Card hover**: overlay `rgba(28,20,12,.72)` over cover; centred "Read" button (#f6efe2 bg, #2b2118 text, 40px, outline 2px #f6efe2 offset 3) and three 36×36 icon buttons (Edit details → drawer, Add to shelf, Remove) with 1px rgba(246,239,226,.4) border.
- Covers without art: solid `oklch(0.46 0.07 <hue>)` (dark: L 0.38) with inset border, title and author. Covers with art: placeholder stripes (real cover image in production).

### 03 Collections
- Header: "Collections" + "3 shelves · 3 smart lists"; secondary "New shelf".
- Shelves: 3-col grid, gap 24. Card padding `26px 26px 22px`, radius 12. Top: 150px "shelf" of book spines (bottom border 4px in shelf colour, spines with vertical-rl titles Newsreader 12px, varied widths 24–34 / heights 110–138). Below: name 26px + "N books", italic note.
- Smart lists: table rows (grid `28px 1fr auto 20px`, padding 16px 6px, divider `--line`): icon · name 18px + italic description · count · chevron.
  - Recently added — "Added in the last 14 days" — 3
  - In progress — "Started and not finished" — 6
  - Finished — "Read to the last word" — 2

### 04 Stats
- Header: "Stats" + "3 – 9 October"; segmented Week / Month / Year / All time.
- KPI strip (3 cols divided by `--line`, padding 24px 28px): label 13px uppercase .14em; value Newsreader 46px/500; italic 15px note.
  - Time reading 4 h 39 m — 83 min more than last week
  - Words read 88,700 — About a third of Middlemarch
  - Average speed 318 wpm — Up from 296 in September
- Lower grid `1.55fr | 1fr`, gap 24:
  - "Minutes per day" bar chart, 14 bars, gap 10; days 0–6 `--line-strong`, 7–12 `color-mix(in oklch, var(--accent) 45%, var(--surface))`, today `--accent` with value label. "11-day streak" in `--accent-text`. Data: 22,35,0,41,28,52,18,30,44,26,38,61,47,33 (max scale 64).
  - "By book": rows title (17px) + time, 6px bars (first `--accent`, others 45% mix). Middlemarch 2 h 06 m, Moby-Dick 1 h 22 m, Q3 Planning Notes 41 m, Walden 30 m.

### 05 Settings · Reading
- Grid `200px | 1fr`, gap 56. Left: H1 "Settings" + sub-nav (Reading [active, `--chip`], Appearance, Library & files, Keyboard shortcuts, About).
- Right (max-width 680): H2 "Reading" 28px; italic intro "Defaults for every book. Speed and appearance can be changed per book from the reader."
- Rows (grid `1fr auto`, padding 18px 0, divider `--line`): title 18px + 15px muted description.
  - Default speed — slider 200px + "320 wpm" — "Used the first time you open a book"
  - Words per flash — segmented 1 / 2 / 3 — "Two or three can help above 500 wpm"
  - Pause longer on punctuation — switch (on)
  - Slow down for long words — switch (on) — "Words over eight letters stay on screen a little longer"
  - Pause at images — switch (on) — "Reading stops on figures and illustrations until you press Space"
  - Ease into speed — switch (off) — "Start each session slower and reach full speed over ten seconds"
  - Hide controls while reading — segmented "After 2 s" / "Never"

### 06 Search (⌘K) overlay
- Scrim `rgba(28,20,12,.28)`. Dialog 620px wide, top 110px, centred, radius 14, shadow `0 24px 60px rgba(0,0,0,.24)`.
- Input row 62px: search icon, 21px query with accent caret, `Esc` kbd.
- Groups with italic 13px headers: **Books** (28×40 cover swatch, Newsreader 17px title with matched substring bold, italic meta "George Eliot · 38%", "↵ Resume" hint on the highlighted row — highlighted row bg `--chip`), **Actions** ("Manage shelves", "Mark Middlemarch as finished").
- Footer hints: "↑ ↓ to move", "↵ to open", "Esc to close".

### 07 / 08 Add to your library (modal, two tabs)
- Scrim `rgba(28,20,12,.34)`. Dialog 640px, centred, radius 14. H2 "Add to your library" 28px; tabs "Files" / "Paste text" (active tab 2px `--accent` underline).
- **Files tab**: dashed drop zone (1.5px dashed `--line-strong`, radius 12, `--bg`): upload icon, "Drop EPUB, PDF or TXT files" (Newsreader 20px), italic "Files stay on this device", "Choose files" button. File list rows (26×38 spine · name + meta · status):
  - Ready: "Frankenstein — frankenstein.epub · 480 KB · 75,000 words" ✓ Ready (accent)
  - Importing: "origin-of-species.pdf — 6.2 MB · extracting text, page 214 of 502", 3px progress bar, "43%"
  - Error: "annual-report-scan.pdf — This PDF is scanned images with no text layer", dashed spine, underlined "Remove"
  - Footer: italic "1 ready · 1 importing · 1 can't be read" + primary "Done" (→ Library).
- **Paste tab**: Title field (42px, Newsreader 18px) "Q4 kickoff memo"; Text area 200px (focused: 2px `--accent` border, Literata 16px lh 1.65); "94 words" / italic "About 18 seconds at 320 wpm" (live: words ÷ wpm). Footer: "Save to library" checkbox (checked), "Cancel", primary "Start reading" → Reader.

### 09 Book details drawer
- Right drawer 452px, full height, `--surface`, left border, shadow `-16px 0 40px rgba(0,0,0,.16)`, scrim behind.
- Header 60px: italic "Details" + close.
- Body (padding 24px 28px, gap 24): 100×150 cover + "Change cover"; editable Title (Newsreader 19px) and Author fields (40px, `--bg`). `<dl>`: Format EPUB · 1.8 MB; Length 316,000 words · 86 chapters; Added 3 September; Last read Today at 7:42 pm. Progress "38% read" / "10 h 12 m left at 320 wpm" + 4px bar. "SHELVES & TAGS": shelf chip (`--chip`, colour tab, × remove), tag chips (italic, outlined), dashed "+ Add". "CONTENTS": chapter rows; read chapters muted with "Read"; current chapter highlighted `--mark` with "Reading · 62%" in `--accent-text`; upcoming show estimated minutes.
- Footer: text button "Remove from library", primary "Resume".

### 10 Reader (paused, with context)
No sidebar. Full-bleed `--bg`.
- **Header** 64px, grid `1fr auto 1fr`, border-bottom: "‹ Library" (back), centred title (Newsreader 17px/500) + italic 13px "Chapter 38", right icon buttons 40×40: Bookmark, Narration, Appearance (opens panel), Full screen.
- **Word stage** (centre, gap 40): 3-column grid `1fr auto 1fr`, baseline aligned, Literata at `rsize` px (default 76, range 56–96), line-height 1.
  - Left cell right-aligned: ghost words (previous 2, `--ghost`) + letters before the focal letter.
  - Centre: **focal letter**, weight 700, `--focal`. Guide ticks above and below: 2×18px `--focal`, 34px from the glyph, opacity .55 (0 when Focus guides off).
  - Right cell: letters after focal + ghost words (next 2).
  - Focal index (ORP) by word length (trailing punctuation stripped): ≤1 → 0, ≤5 → 1, ≤9 → 2, ≤13 → 3, else 4.
- **Context panel** (720px max, padding `22px 28px 20px`, `--surface`, radius 12): "CONTEXT" label + italic "Click any word to jump · Esc to close"; paragraph Literata 18px lh 1.7; current word bg `--mark` + `inset 0 -2px 0 var(--focal)` underline. Clicking a word seeks to it.
- **Footer** (padding `0 32px 22px`):
  - Position slider 16px tall: 3px track, `--accent` fill, chapter ticks (1×9px muted), 14px thumb (surface fill, 2px accent border).
  - Row grid `1fr auto 1fr`: left stats "38% · 10 h 12 m left" (16px ink) and "120,080 of 316,000 words" (14px muted, tabular). Centre transport 42×42 icon buttons: Stop, Prev paragraph, Prev sentence, Prev word, **Play/Pause** (60px circle `--accent`, outline 2px `--focus` offset 3), Next word, Next sentence, Next paragraph. Right: speed presets pills 250 (Comfortable) / 400 (Brisk) / 600 (Sprint) (32px, radius 16, 13px), and stepper − [wpm Newsreader 24px + "WPM" 11px] + (48px tall, radius 10).
  - While playing: header & footer fade to opacity 0 after 2 s (transition .5s), return on mouse move; a 2px `--accent` progress line sits at the very bottom edge.

### 11 Reader · Appearance panel
Popover anchored top 64 / right 16, 340px, padding `18px 20px 20px`, radius 12, shadow `0 16px 44px rgba(0,0,0,.2)`. Sections (label 13px uppercase .14em muted):
- **Typeface**: 3 tiles 52px — Literata (selected: 2px `--accent` border, `--bg`), Newsreader, Sans.
- **Word size**: "{n} px" readout; "A" (14px) / slider / "A" (20px) buttons, step 4, range 56–96.
- **Focal letter**: 5 swatches 32px circles: #a83b22, #2f6a3f, #24407a, #9a4f08, #2b2118. Selected = 2px surface gap + 2px `--ink` ring. In dark mode apply as `color-mix(in oklch, <c>, white 40%)`.
- **Switches** (rows 12px padding, dividers): Ghost words either side (on) · Focus guides (on) · Show context when paused (on) · **Always show context** (off) · **Bionic font** (off).
  - *Always show context*: context panel stays visible during playback, tracking the current word.
  - *Bionic font*: bold (700) the first ⌈len/2⌉ letters of each word (trailing punctuation excluded) in the word stage and context panel. The focal letter keeps its colour/weight; ghost words are not bolded.
- Switch spec: 46×28 track, radius 14, padding 3; knob 22px `--surface` with `0 1px 2px rgba(0,0,0,.25)`; on = `--accent`, off = `--line-strong`. `role="switch"` + `aria-checked`.

### 12 Reader · Paused at image
Replaces word stage when playback reaches a figure (if "Pause at images" is on).
- Figure 620px max: image 360px tall, radius 6, 1px `--line`; italic Literata 17px caption ("Dorothea in the Vatican, from the 1910 illustrated edition").
- Bar (`--surface`, radius 12): image icon + "Paused at an image"; secondary "Skip images in this book" (turns the setting off for this book and continues); primary "Continue" with `Space` kbd.

---

---

## Mobile (iPhone, 390 × 844)
Same tokens, fonts, copy and data as desktop. Design frame 390 × 844 (status bar 47px, home indicator 34px). All hit targets ≥ 44px. Shown as 3a (Sepia) and 3b (Moss) in the overview canvas. Source: `Readable Paper Mobile.dc.html`.

### Shell
- No sidebar. **Bottom tab bar**: Home, Library, Collections, Stats, Settings — 5 equal columns, 24px icons + 11px label, height 48 + 34px safe-area padding, bg `--sidebar`, top border `--line`. Active `--accent-text`, inactive `--muted`. Hidden in Reader.
- Screen padding `10px 20px 24px`; content scrolls vertically inside the screen. H1 Newsreader 32px/500.
- Round header icon buttons 44×44 (radius 22, `--surface`, 1px `--line`); primary variant `--accent` fill.
- Shelves, smart lists and account live in Collections / Settings instead of the sidebar.

### Screens
- **Home**: date + "Good evening" with search button. Continue card (padding 18, radius 16): 92×138 cover + eyebrow / title 28px / author / "Chapter 38"; progress row "38% read" · "10 h 12 m left · 320 wpm" with 4px bar; buttons Resume (primary, 50px, flexes) + Details (secondary). Then two equal secondary buttons Add books / Paste text (48px). "Recently read" horizontal scroller of 100px-wide tiles (bleeds to screen edge).
- **Library**: title + live count, search + add (+) round buttons. Horizontally scrolling chips (38px, radius 19): All / Unread / In progress / Finished (active = `--ink` fill, `--bg` text) + Shelf ▾. 3-column grid, gap `20px 14px`; tiles show cover, title 14px, progress + status ("38%", "Done", "New"). Tapping a tile opens the details sheet.
- **Collections**: shelves as stacked full-width cards (spine shelf 104px tall). Smart lists in a grouped card, rows ≥ 60px with chevron.
- **Stats**: full-width 4-segment range control (Week / Month / Year / All). KPI card: Time reading full width (40px value), Words read + Avg speed side by side (28px). 14-bar chart (150px, gap 5) and By book card.
- **Settings**: grouped cards (radius 14, rows ≥ 60px). "READING": Default speed stepper (− wpm +), Words per flash 1/2/3, four switches (Pause on punctuation, Slow down for long words, Pause at images, Ease into speed), Hide controls "After 2 s" / "Never". "MORE": Appearance, Library & files, Account & sync ("Soon"), About — chevron rows 52px.
- **Search**: full-screen over everything. Field 44px radius 12 + "Cancel" text button (accent). Results grouped Books / Actions as desktop.
- **Add books sheet**: bottom sheet from top 64px, radius `20px 20px 0 0`, 36×5 grabber, scrim `rgba(28,20,12,.34)`. Tabs Files / Paste text. Files: picker zone with "Choose from Files" (no drag-and-drop), same three import states, full-width Done (50px). Paste: Title, 250px text area, counts, "Save to library" checkbox, full-width Start reading.
- **Book details sheet**: from top 96px. Cover 84×126 + title 26px + author + "Edit title, author, cover" link; progress; details list; shelf/tag chips (36px); contents (44px rows, current chapter `--mark`); "Remove from library" text button; sticky full-width Resume.
- **Reader**: header 52px — back chevron, centred title 16px + chapter 12px italic, bookmark and Aa (appearance) buttons. Word stage fills the middle; **tap anywhere on it to play/pause** (when chrome is hidden, the first tap only reveals controls). Word size default 44px (range 32–60, step 2); guide ticks 14px tall, 24px from glyph. Ghost words default **off** on mobile (1 word each side when on). Context card full width, Literata 15px/1.6, "Tap a word to jump" (taps inside the card don't toggle playback). If context is off, show italic hint "Tap anywhere to play or pause". Footer: 20px position slider (16px thumb), stats row ("38% · 10 h 12 m left" / "120,080 / 316,000"), transport (prev sentence, prev word, 68px play, next word, next sentence — 48px buttons), speed row (250/400/600 pills 44px + wpm stepper). Narration and full-screen are omitted on mobile. 3px accent progress line at bottom while playing.
- **Appearance sheet**: bottom sheet over the reader (lighter scrim `.2`). Typeface tiles (50px), word size A / slider / A (44px buttons, 20px thumb), focal letter swatches (30px dots in 44px targets), switches: Ghost words either side, Focus guides, Show context when paused, Always show context, Bionic font. iOS-size switches 51×31, white 27px knob.
- **Paused at image**: 260px figure + caption; card with "Paused at an image" and two equal buttons Skip images / Continue (48px).

### Mobile behaviour notes
- Settings toggles, wpm stepper, segmented controls, library status filter and typeface choice are functional in this prototype; punctuation/long-word toggles change timing, "Never" disables chrome auto-hide.
- Respect safe areas (`env(safe-area-inset-*)`) rather than the fixed 47/34px used in the mock.
- Sheets should support swipe-down to dismiss; Search "Cancel" closes.

## Interactions & behaviour
- **Navigation**: sidebar links switch screens; "Resume"/"Read"/"Start reading"/current chapter → Reader; Reader "‹ Library" → Library; "Details"/edit icon → drawer; "Add books" → import modal (Files); "Paste text" → import modal (Paste); "View library", shelves, smart lists → Library (filtered in production).
- Opening any overlay pauses playback. Clicking scrim or close closes it. **Esc** closes overlays; in Reader with no overlay, Esc pauses.
- **⌘K / Ctrl+K** anywhere opens Search.
- **Reader keyboard**: Space play/pause · ← / → previous/next word · ↑ / + / = speed +25 · ↓ / − speed −25. Speed clamps 50–1000. At an image, Space continues.
- **Timing per word**: `base = 60000 / wpm` ms; × 2.2 if word ends in `. ; ! ?`; × 1.6 if ends in `, :`; × 1.25 if longer than 8 chars (both controlled by Settings toggles). "Ease into speed" ramps from a slower rate to full over 10 s. "Words per flash" 2–3 shows that many words per tick.
- **Sentence nav**: previous = start of current sentence (or previous one if already at start); next = first word after next terminal punctuation. Stop = pause + return to sentence start. Paragraph nav jumps to paragraph boundaries.
- **Chrome auto-hide**: during playback, header/footer fade after 2 s idle (or never, per Settings); mouse move restores.
- **Hover**: Library cover shows action overlay; buttons/links use pointer cursor. Production should add hover backgrounds (`--chip` on ghost buttons) and visible focus rings (2px `--focus`, offset 3) for keyboard users.
- **Import states**: ready / extracting (progress %) / unreadable (no text layer) per file.
- **Prototype limitations to implement properly**: Settings speed slider and segmented controls are static; Settings toggles don't yet drive reader behaviour; Typeface tiles are static; appearance choices are per-session. In production, Settings = global defaults, Appearance panel = per-book overrides, both persisted.

## State management
- `library`: books `{ id, title, author, format, sizeBytes, wordCount, chapters[], progressWordIndex, lastReadAt, addedAt, shelves[], tags[], coverUrl? }`
- `shelves`: `{ id, name, color }`; smart lists are derived queries.
- `readerSession`: `{ bookId, wordIndex, playing, wpm, chromeVisible, overlay }`
- `readingPrefs` (global defaults + per-book overrides): `defaultWpm (320)`, `wordsPerFlash (1)`, `punctuationPause (true)`, `longWordSlowdown (true)`, `pauseAtImages (true)`, `easeIn (false)`, `hideControls ('2s' | 'never')`
- `appearancePrefs`: `typeface ('literata' | 'newsreader' | 'sans')`, `wordSize (76)`, `focalColor`, `ghostWords (true)`, `focusGuides (true)`, `contextWhenPaused (true)`, `contextAlways (false)`, `bionic (false)`
- `ui`: `theme ('light' | 'dark' | system)`, `palette ('sepia' | 'moss')`, active screen, active overlay.
- `stats`: daily minutes, words read, average wpm, per-book time — logged from reader sessions.
- Import pipeline: on-device text extraction for EPUB/PDF/TXT with progress events; detect PDFs without a text layer.

## Design tokens

### Fonts (Google Fonts)
- `--display` and `--ui`: **Newsreader** (opsz 6–72; 400, 500, 600, italic 400), fallback Georgia, serif
- `--reader`: **Literata** (opsz 7–72; 400, 500, 700), fallback Georgia, serif
- Monospace not used in product UI.

### Type scale (px)
11 · 12 · 13 · 14 · 15 · 16 · 17 · 18 · 20 · 21 · 22 · 24 · 25 · 26 · 28 · 36 · 38 · 42 · 46 · reader word 56–96 (default 76).
Uppercase labels: 13px, letter-spacing .14em (.16em for eyebrows). Headlines: weight 500, letter-spacing −0.015em. Italic is used for secondary/meta text throughout.

### Radii
3 (badges, kbd 4) · 6 · 7 (segment) · 8 (buttons, inputs, nav) · 9 (segment container) · 10 (wpm stepper) · 12 (cards, panels) · 14 (modals) · 16 (pills/chips) · 50% (play button, swatches). Book covers `2px 5px 5px 2px` (hero `3px 7px 7px 3px`).

### Spacing
Common steps: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 36, 40, 44, 48, 56. Control heights: 32 (segments/pills), 36 (icon buttons), 38 (nav, dropdowns), 40–44 (buttons), 60 (play).

### Shadows
- `--shadow` light: `0 1px 2px rgba(60,40,20,.08), 0 8px 24px rgba(60,40,20,.06)`; dark: `0 1px 2px rgba(0,0,0,.3)`
- `--book-shadow` light: `0 1px 2px rgba(60,40,20,.2), 0 6px 14px rgba(60,40,20,.16)`; dark: `0 1px 2px rgba(0,0,0,.4), 0 6px 14px rgba(0,0,0,.35)`
- Modal `0 24px 60px rgba(0,0,0,.24)`; popover `0 16px 44px rgba(0,0,0,.2)`; drawer `-16px 0 40px rgba(0,0,0,.16)`
- Scrims: `rgba(28,20,12,.34)` (modal/drawer), `.28` (search), cover hover `.72`

### Colours — 1a Sepia
| token | light | dark |
|---|---|---|
| --bg | #f4ede0 | #1c1813 |
| --surface | #fbf7ef | #25201a |
| --sidebar | #ece3d2 | #16130f |
| --chip | #e6dbc7 | #2e2820 |
| --ink | #2b2118 | #ede4d3 |
| --muted | #6b5a48 | #a99b87 |
| --ghost | rgba(43,33,24,.24) | rgba(237,228,211,.22) |
| --line | rgba(60,40,20,.12) | rgba(237,228,211,.10) |
| --line-strong | rgba(60,40,20,.24) | rgba(237,228,211,.22) |
| --accent | #9e3d27 | #e0906f |
| --on-accent | #fbf7ef | #1c1813 |
| --accent-text | #9e3d27 | #e0906f |
| --focal | #a83b22 | #f0a07c |
| --mark | rgba(168,59,34,.12) | rgba(240,160,124,.18) |
| --focus | #2b2118 | #f3dcc0 |
| --stripe | rgba(60,40,20,.08) | rgba(237,228,211,.07) |
| --hero-cover | oklch(0.46 0.08 25) | oklch(0.4 0.07 25) |

### Colours — 2a Moss (shadows inherit from Sepia)
| token | light | dark |
|---|---|---|
| --bg | #f1efe4 | #171a14 |
| --surface | #f9f8f1 | #1f231b |
| --sidebar | #e7e5d6 | #121510 |
| --chip | #dedcc9 | #2a2f24 |
| --ink | #22261c | #e6e8d8 |
| --muted | #5c6150 | #a3a891 |
| --ghost | rgba(34,38,28,.24) | rgba(230,232,216,.22) |
| --line | rgba(40,50,30,.12) | rgba(230,232,216,.10) |
| --line-strong | rgba(40,50,30,.24) | rgba(230,232,216,.22) |
| --accent | #3d6838 | #9cc48a |
| --on-accent | #f9f8f1 | #171a14 |
| --accent-text | #3d6838 | #9cc48a |
| --focal | #2f6a3f | #a8d094 |
| --mark | rgba(47,106,63,.13) | rgba(168,208,148,.18) |
| --focus | #22261c | #e6e8d8 |
| --stripe | rgba(40,50,30,.08) | rgba(230,232,216,.07) |
| --hero-cover | oklch(0.42 0.06 145) | oklch(0.38 0.06 145) |

### Other fixed colours
- Cover text/inset borders: #f6efe2 / rgba(246,239,226,.42–.45)
- Generated cover bg: `oklch(0.46 0.07 <hue>)` light, `oklch(0.38 0.07 <hue>)` dark (hue per book)
- Shelf colours: `oklch(0.5 0.08 20 | 250 | 140)`
- Chart secondary: `color-mix(in oklch, var(--accent) 45%, var(--surface))`

## Assets
- Icons: inline 24×24 stroke SVGs (stroke 1.6, round caps/joins), drawn for this prototype. Replace with the codebase's icon set (Lucide is a close match) at the same sizes: 15–20px.
- Book covers and the reader illustration are striped placeholders. Use real cover images extracted from EPUB/PDF, falling back to the generated typographic cover.
- Fonts: Newsreader and Literata from Google Fonts (OFL).
- Sample content (Middlemarch excerpt, book list, stats) is demo data.

## Files
- `Readable Paper.dc.html` — the full app component: all screens, overlays, tokens (in `renderVals()`), and reader logic. Props: `palette` (sepia | moss), `theme` (light | dark), `screen`, `overlay`.
- `Readable Paper Mobile.dc.html` — mobile app component (same props as desktop).
- `Readable Paper Screens.dc.html` — overview canvas: mobile (3a Sepia, 3b Moss) at the top, then desktop (1a, 2a); every state in light and dark.
- `support.js` — runtime needed to open the HTML files locally. Not part of the design.
