# Claude Design prompt: Readable UI revamp

```
Design a new UI for "Readable", a desktop app (Tauri, 1280×800 minimum, resizable; adapts gracefully to narrow windows) that helps people read more comfortably and quickly by showing text one word at a time (RSVP / speed-reading style) with extensive typography and accessibility control.

## Explore three visual directions
I don't have a preferred look yet, so produce THREE distinct directions of the same app, then I'll pick the best to build out:
  A. "Paper" — warm, bookish, sepia/cream paper tones, serif-forward typography, soft shadows, feels like a quiet reading room.
  B. "Minimal" — modern and neutral, crisp sans-serif, lots of whitespace, hairline borders, restrained single accent color (think Linear / Things).
  C. "Playful" — friendly and energetic, rounded shapes, bolder color blocks, expressive covers and illustrations, but still calm enough to read in.
For each direction show the same key screens (listed under Deliverable) so they can be compared side by side. Each direction needs light and dark themes. Replace all emoji with a consistent line-icon set. No stock-photo clichés.

## Product constraints for v1
v1 is LOCAL-ONLY: no sign-in, no accounts, no cloud sync. Books live on the user's device. Do NOT design a sign-in screen. Leave a quiet, non-intrusive placeholder in the sidebar footer for a future "Account & sync (coming soon)" entry so the layout can grow into it later, and keep per-book status simple (no synced/syncing states yet).

## Core reading experience (KEEP THESE BEHAVIORS, redesign the presentation)
The Reader screen is the heart of the app:
- One word at a time, centered, with a fixed focal letter highlighted (accent color + heavier weight) and subtle vertical alignment guide/tick marks above and below it so the eye stays anchored. The word is positioned so the focal letter always sits on the same x-coordinate.
- Trailing punctuation shown with the word. Optional faint "ghost" context: the previous and next word or two very dimmed, toggleable.
- Playback: Play / Pause / Stop, skip back/forward by word, sentence, and paragraph. Space = play/pause, ←/→ = seek, ↑/↓ or +/- = speed.
- Speed control: WPM from 50–1000, shown prominently and adjustable by slider, stepper, and keyboard, with presets (Comfortable 250 / Brisk 400 / Sprint 600). A "ramp up" option that eases from a slow start to target speed. Option for extra pause at punctuation and long words (design the toggle/slider).
- Progress: percentage, words read / total, estimated time remaining at current WPM, current chapter. A thin scrubber with chapter ticks that can be dragged to seek.
- Image/figure blocks: reading auto-pauses and shows the figure with caption and a "Continue" button (Space also continues).
- Optional text-to-speech narration synced to the words, with voice, rate, and pitch controls.
- Controls auto-hide while playing (fade after a couple of seconds without mouse movement), leaving only the word and a hairline progress bar; moving the mouse brings them back. Include a distraction-free full-screen mode.
- "Peek context": pausing can reveal the surrounding paragraph with the current word highlighted so the reader can re-orient; clicking any word jumps there.

## Reading appearance panel (slide-over drawer, LIVE preview of a sample word)
- Font family picker showing each option rendered in its own face: Inter, Georgia, Merriweather, Literata, OpenDyslexic, Atkinson Hyperlegible, a monospace option.
- Font size (24–96px), weight, letter spacing, line height.
- Focal letter: color, weight, guide-mark style.
- Theme: light / dark / sepia / high-contrast, with background and text color overrides.
- Pause behavior, TTS settings, keyboard shortcut reference.
- One-click presets ("Dyslexia-friendly", "Low vision", "Night reading") plus saving custom presets. Settings can apply globally or per book.

## Library / book management (THE BIGGEST REDESIGN)
Today it is two plain grids with emoji placeholders, no covers, "Unknown" authors, and no organization. Redesign as a proper personal library:
- Home with a "Continue reading" hero (last book, progress ring, resume position, time left) above the library.
- Cover grid with toggles for list and compact views. Each card: cover (with a designed fallback cover generated from title/author/color when none exists), title, author, format badge (EPUB / PDF / TXT), progress bar, last-read date. Hover reveals quick actions (Read, Edit details, Add to collection, Remove).
- Search, sort (recent, title, author, progress, date added), filters (Unread / In progress / Finished, format, collection, tag).
- Collections and tags: sidebar with user-created shelves ("Fiction", "Work", "To read") and smart lists (Recently added, In progress, Finished).
- Import: large drag-and-drop zone and "Add books" button, multi-file import with per-file progress and error states (unsupported format, parse failure, scanned PDF with no text). Also "paste text" as a quick read-this source.
- Book details drawer: editable title, author, cover (upload or auto), description, tags, collection; per-book stats (time spent, average WPM, words read); bookmarks and highlights that jump into the reader; chapter list to start from a chapter.
- Empty states: first run, empty library, no search results.

## Other screens
- Reading stats: streak, words and time per day/week, average WPM trend, per-book completion. Simple, calm charts.
- App settings: default theme, default speed, storage location, shortcuts.

## Navigation
Collapsible left sidebar: Home, Library, Collections, Stats, Settings, with the "Account & sync (coming soon)" placeholder at the bottom. The Reader is a full-bleed mode that hides the sidebar. Command palette (Ctrl/Cmd+K) for searching books and jumping to actions.

## Accessibility (non-negotiable)
WCAG AA contrast minimum in every theme, visible focus rings, full keyboard operability, honors reduced motion, screen-reader labels, large hit targets, no information conveyed by color alone.

## Deliverable
For EACH of the three directions, light and dark: (1) Home with continue-reading, (2) Library grid with sidebar, filters, and a book hover state, (3) Book details drawer, (4) Import drag-drop and progress state, (5) Reader playing with controls hidden, (6) Reader paused with controls visible and context peek open, (7) Reading appearance drawer with live preview, (8) Image-block pause, (9) Stats. Then a compact design system per direction: color tokens per theme, type scale, spacing, component states (buttons, sliders, cards, chips, toggles), icon style. Finish with a one-paragraph comparison of the three directions.
```
