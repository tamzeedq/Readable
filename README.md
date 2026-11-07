# Readable

A calm, local-first desktop reader that shows books **one word at a time** (RSVP) at a pace you choose. Each word is pinned on its optimal recognition point, the "focal letter", so your eyes stay still and the words come to you.

Built with Tauri 2, React 19, TypeScript, Vite and Zustand.

## Features

- **Focus reader**: 50–1000 wpm, focal-letter alignment with guide ticks, ghost words either side, a context panel when paused, bionic mode, 1–3 words per flash, longer pauses on punctuation and long words, ease-in, pause at images, narration (Web Speech API), auto-hiding controls, full screen.
- **Comfortable type**: Literata, Newsreader, Inter, Atkinson Hyperlegible and OpenDyslexic, all bundled for offline use. Global defaults plus per-book overrides.
- **Library**: import EPUB, PDF and TXT files or paste text. Covers, chapters and metadata are extracted on device. Shelves, tags, smart lists (recently added, in progress, finished), search and sort, grid/list/compact views, book details with a chapter list and bookmarks.
- **Stats**: reading time, words read, average speed, daily chart, streak, time per book.
- **Search** across books and actions with `Ctrl K` / `⌘K`.
- **Themes**: Sepia and Moss palettes, each in light and dark (or following the system). There is a mobile layout below 720px.

Everything stays on the device. Account and sync are planned for a later version.

## Development

Prerequisites: Node 20+, Rust, and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run tauri dev   # desktop app
npm run dev         # browser only, http://localhost:1420
npm run build       # typecheck + production web build
npm run tauri build # desktop installer
```

## Project layout

```
src/
  styles/        design tokens (palettes × light/dark) and shared primitives
  store/         zustand store (persisted): library, shelves, prefs, stats, navigation
  lib/           parser (EPUB/PDF/TXT), importer, IndexedDB storage, samples, narration, formatting
  components/    shell (sidebar, tab bar) and UI primitives (cover, switch, overlays…)
  screens/       Home, Library, Collections, Stats, Settings
  overlays/      Search, Add books, Book details
  reader/        reading engine, text helpers, Reader screen and its panels
design/          design handoff (source of truth for the UI)
docs/archive/    notes from the previous prototype
```

## Keyboard

| Where | Keys |
|---|---|
| Reader | `Space` play/pause · `←` `→` previous/next word · `↑` `+` faster · `↓` `−` slower · `Esc` pause |
| Anywhere | `Ctrl K` / `⌘K` search |
