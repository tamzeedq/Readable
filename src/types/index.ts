// Core domain types. See design/handoff/README.md "State management".

export type BookFormat = 'epub' | 'pdf' | 'txt' | 'paste';

export interface Chapter {
  title: string;
  /** Index into BookContent.words where this chapter starts */
  startWord: number;
}

/** Library metadata — small, persisted in localStorage via zustand. */
export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  sizeBytes: number;
  wordCount: number;
  chapters: Chapter[];
  /** Word index the reader should resume at */
  progressWordIndex: number;
  lastReadAt: number | null;
  addedAt: number;
  finishedAt: number | null;
  /** Shelf ids */
  shelves: string[];
  tags: string[];
  description?: string;
  /** True when a cover image is stored in IndexedDB (see lib/bookStorage) */
  hasCover: boolean;
  /** Hue (0–360) for the generated typographic cover */
  coverHue: number;
  /** Word indices */
  bookmarks: number[];
  /** Per-book overrides of the global defaults (set from the reader) */
  wpm?: number;
  appearance?: Partial<AppearancePrefs>;
  skipImages?: boolean;
  /** Pasted text read without "Save to library": hidden from library views, purged on next launch */
  transient?: boolean;
}

export interface BookImage {
  /** Word index the image appears before. Reader pauses when it reaches this index. */
  at: number;
  blob: Blob;
  alt: string;
  caption?: string;
}

/** Full text of a book — large, stored in IndexedDB keyed by book id. */
export interface BookContent {
  bookId: string;
  /** Display tokens in reading order, punctuation attached (e.g. "garments,") */
  words: string[];
  /** Sorted word indices where paragraphs begin (always starts with 0) */
  paragraphStarts: number[];
  /** Sorted by `at` */
  images: BookImage[];
}

export interface Shelf {
  id: string;
  name: string;
  /** CSS colour, e.g. oklch(0.5 0.08 20) */
  color: string;
  note?: string;
}

export type HideControls = '2s' | 'never';

export interface ReadingPrefs {
  defaultWpm: number;
  wordsPerFlash: 1 | 2 | 3;
  punctuationPause: boolean;
  longWordSlowdown: boolean;
  pauseAtImages: boolean;
  easeIn: boolean;
  hideControls: HideControls;
}

export type Typeface = 'literata' | 'newsreader' | 'sans' | 'atkinson' | 'opendyslexic';

export interface AppearancePrefs {
  typeface: Typeface;
  /** Desktop word size in px (56–96). Mobile uses its own scale. */
  wordSize: number;
  /** null = palette default focal colour */
  focalColor: string | null;
  ghostWords: boolean;
  focusGuides: boolean;
  contextWhenPaused: boolean;
  contextAlways: boolean;
  bionic: boolean;
  /** Mobile word size in px (32–60, default 44). Undefined = default. */
  mobileWordSize?: number;
  /** Ghost words on mobile (default off). Undefined = default. */
  mobileGhostWords?: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type Palette = 'sepia' | 'moss';

export type Screen = 'home' | 'library' | 'collections' | 'stats' | 'settings' | 'reader';
export type Overlay = 'none' | 'search' | 'import' | 'paste' | 'details' | 'appearance' | 'shortcuts' | 'onboarding';

export type StatusFilter = 'all' | 'unread' | 'in-progress' | 'finished';

/** Library filter that other screens can deep-link into (shelves, smart lists, View library). */
export interface LibraryFilter {
  status: StatusFilter;
  shelfId: string | null;
  tag: string | null;
  format: BookFormat | null;
  /** Smart list: recently added (last 14 days) */
  recent: boolean;
  query: string;
}

/** Per day (YYYY-MM-DD, local) per book reading totals */
export interface DayBookStats {
  ms: number;
  words: number;
}
export type ReadingLog = Record<string, Record<string, DayBookStats>>;
