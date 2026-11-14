import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppearancePrefs,
  Book,
  LibraryFilter,
  Overlay,
  Palette,
  ReadingLog,
  ReadingPrefs,
  Screen,
  Shelf,
  ThemeMode,
} from '../types';
import { deleteBookData } from '../lib/bookStorage';
import { dayKey } from '../lib/format';

export const defaultReadingPrefs: ReadingPrefs = {
  defaultWpm: 320,
  wordsPerFlash: 1,
  punctuationPause: true,
  longWordSlowdown: true,
  pauseAtImages: true,
  easeIn: false,
  hideControls: '2s',
};

export const defaultAppearancePrefs: AppearancePrefs = {
  typeface: 'literata',
  wordSize: 76,
  focalColor: null,
  ghostWords: true,
  focusGuides: true,
  contextWhenPaused: true,
  contextAlways: false,
  bionic: false,
};

export const defaultLibraryFilter: LibraryFilter = {
  status: 'all',
  shelfId: null,
  tag: null,
  format: null,
  recent: false,
  query: '',
};

const defaultShelves: Shelf[] = [
  { id: 'fiction', name: 'Fiction', color: 'oklch(0.5 0.08 20)' },
  { id: 'work', name: 'Work', color: 'oklch(0.5 0.08 250)' },
  { id: 'to-read', name: 'To read', color: 'oklch(0.5 0.08 140)' },
];

/** Hues cycled for newly created shelves */
const SHELF_HUES = [20, 250, 140, 70, 310, 195, 345, 110];

export const newId = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

export interface AppState {
  // ---- Library (persisted) ----
  books: Book[];
  shelves: Shelf[];
  addBook: (book: Book) => void;
  updateBook: (id: string, patch: Partial<Book>) => void;
  /** Removes metadata and IndexedDB content */
  removeBook: (id: string) => void;
  setProgress: (id: string, wordIndex: number) => void;
  toggleBookmark: (id: string, wordIndex: number) => void;
  addShelf: (name: string) => Shelf;
  updateShelf: (id: string, patch: Partial<Shelf>) => void;
  removeShelf: (id: string) => void;
  toggleBookShelf: (bookId: string, shelfId: string) => void;

  // ---- Preferences (persisted) ----
  readingPrefs: ReadingPrefs;
  appearancePrefs: AppearancePrefs;
  setReadingPrefs: (patch: Partial<ReadingPrefs>) => void;
  setAppearancePrefs: (patch: Partial<AppearancePrefs>) => void;
  /** Per-book appearance override (from the reader's Appearance panel) */
  setBookAppearance: (bookId: string, patch: Partial<AppearancePrefs>) => void;
  theme: ThemeMode;
  palette: Palette;
  setTheme: (theme: ThemeMode) => void;
  setPalette: (palette: Palette) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // ---- Stats (persisted) ----
  readingLog: ReadingLog;
  /** Record reading time and words for a book on today's date */
  logReading: (bookId: string, ms: number, words: number) => void;

  // ---- UI (not persisted) ----
  screen: Screen;
  overlay: Overlay;
  /** Book the details drawer / reader is showing */
  activeBookId: string | null;
  libraryFilter: LibraryFilter;
  /** One-shot: settings section to open on next visit (not persisted) */
  settingsTarget: string | null;
  navigate: (screen: Screen) => void;
  openOverlay: (overlay: Overlay, bookId?: string) => void;
  closeOverlay: () => void;
  openReader: (bookId: string, atWord?: number) => void;
  openLibrary: (filter?: Partial<LibraryFilter>) => void;
  setLibraryFilter: (patch: Partial<LibraryFilter>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ---- Library ----
      books: [],
      shelves: defaultShelves,
      addBook: (book) => set((s) => ({ books: [book, ...s.books] })),
      updateBook: (id, patch) =>
        set((s) => ({ books: s.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      removeBook: (id) => {
        void deleteBookData(id);
        set((s) => ({
          books: s.books.filter((b) => b.id !== id),
          activeBookId: s.activeBookId === id ? null : s.activeBookId,
          overlay: s.activeBookId === id ? 'none' : s.overlay,
          screen: s.activeBookId === id && s.screen === 'reader' ? 'library' : s.screen,
        }));
      },
      setProgress: (id, wordIndex) =>
        set((s) => ({
          books: s.books.map((b) => {
            if (b.id !== id) return b;
            const finished = b.wordCount > 0 && wordIndex >= b.wordCount - 1;
            return {
              ...b,
              progressWordIndex: wordIndex,
              lastReadAt: Date.now(),
              finishedAt: finished ? (b.finishedAt ?? Date.now()) : b.finishedAt,
            };
          }),
        })),
      toggleBookmark: (id, wordIndex) =>
        set((s) => ({
          books: s.books.map((b) =>
            b.id !== id
              ? b
              : {
                  ...b,
                  bookmarks: b.bookmarks.includes(wordIndex)
                    ? b.bookmarks.filter((w) => w !== wordIndex)
                    : [...b.bookmarks, wordIndex].sort((a, c) => a - c),
                },
          ),
        })),
      addShelf: (name) => {
        const hue = SHELF_HUES[get().shelves.length % SHELF_HUES.length];
        const shelf: Shelf = { id: newId(), name, color: `oklch(0.5 0.08 ${hue})` };
        set((s) => ({ shelves: [...s.shelves, shelf] }));
        return shelf;
      },
      updateShelf: (id, patch) =>
        set((s) => ({ shelves: s.shelves.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)) })),
      removeShelf: (id) =>
        set((s) => ({
          shelves: s.shelves.filter((sh) => sh.id !== id),
          books: s.books.map((b) => ({ ...b, shelves: b.shelves.filter((x) => x !== id) })),
        })),
      toggleBookShelf: (bookId, shelfId) =>
        set((s) => ({
          books: s.books.map((b) =>
            b.id !== bookId
              ? b
              : {
                  ...b,
                  shelves: b.shelves.includes(shelfId)
                    ? b.shelves.filter((x) => x !== shelfId)
                    : [...b.shelves, shelfId],
                },
          ),
        })),

      // ---- Preferences ----
      readingPrefs: defaultReadingPrefs,
      appearancePrefs: defaultAppearancePrefs,
      setReadingPrefs: (patch) => set((s) => ({ readingPrefs: { ...s.readingPrefs, ...patch } })),
      setAppearancePrefs: (patch) =>
        set((s) => ({ appearancePrefs: { ...s.appearancePrefs, ...patch } })),
      setBookAppearance: (bookId, patch) =>
        set((s) => ({
          books: s.books.map((b) =>
            b.id === bookId ? { ...b, appearance: { ...b.appearance, ...patch } } : b,
          ),
        })),
      theme: 'system',
      palette: 'sepia',
      setTheme: (theme) => set({ theme }),
      setPalette: (palette) => set({ palette }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      // ---- Stats ----
      readingLog: {},
      logReading: (bookId, ms, words) => {
        if (ms <= 0 && words <= 0) return;
        const day = dayKey(new Date());
        set((s) => {
          const dayLog = s.readingLog[day] ?? {};
          const prev = dayLog[bookId] ?? { ms: 0, words: 0 };
          return {
            readingLog: {
              ...s.readingLog,
              [day]: { ...dayLog, [bookId]: { ms: prev.ms + ms, words: prev.words + words } },
            },
          };
        });
      },

      // ---- UI ----
      screen: 'home',
      overlay: 'none',
      activeBookId: null,
      libraryFilter: defaultLibraryFilter,
      settingsTarget: null,
      navigate: (screen) => set({ screen, overlay: 'none' }),
      openOverlay: (overlay, bookId) =>
        set((s) => ({ overlay, activeBookId: bookId ?? s.activeBookId })),
      closeOverlay: () => set({ overlay: 'none' }),
      openReader: (bookId, atWord) => {
        if (atWord !== undefined) get().setProgress(bookId, atWord);
        set({ screen: 'reader', overlay: 'none', activeBookId: bookId });
      },
      openLibrary: (filter) =>
        set({
          screen: 'library',
          overlay: 'none',
          libraryFilter: { ...defaultLibraryFilter, ...filter },
        }),
      setLibraryFilter: (patch) => set((s) => ({ libraryFilter: { ...s.libraryFilter, ...patch } })),
    }),
    {
      name: 'readable-v1',
      version: 1,
      partialize: (s) => ({
        books: s.books,
        shelves: s.shelves,
        readingPrefs: s.readingPrefs,
        appearancePrefs: s.appearancePrefs,
        theme: s.theme,
        palette: s.palette,
        sidebarCollapsed: s.sidebarCollapsed,
        readingLog: s.readingLog,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          readingPrefs: { ...defaultReadingPrefs, ...p.readingPrefs },
          appearancePrefs: { ...defaultAppearancePrefs, ...p.appearancePrefs },
        };
      },
    },
  ),
);

/** Effective appearance for a book: global defaults overlaid with per-book overrides */
export function useAppearance(bookId: string | null): AppearancePrefs {
  const global = useAppStore((s) => s.appearancePrefs);
  const override = useAppStore((s) =>
    bookId ? s.books.find((b) => b.id === bookId)?.appearance : undefined,
  );
  return override ? { ...global, ...override } : global;
}

/** Books that belong in library views (excludes transient pasted text) */
export function useLibraryBooks(): Book[] {
  const books = useAppStore((s) => s.books);
  return useMemo(() => books.filter((b) => !b.transient), [books]);
}

export function useBook(bookId: string | null): Book | undefined {
  return useAppStore((s) => (bookId ? s.books.find((b) => b.id === bookId) : undefined));
}

/** Derived status used by filters, smart lists and tiles */
export function bookStatus(b: Book): 'unread' | 'in-progress' | 'finished' {
  if (b.finishedAt || (b.wordCount > 0 && b.progressWordIndex >= b.wordCount - 1)) return 'finished';
  if (b.progressWordIndex > 0 || b.lastReadAt) return 'in-progress';
  return 'unread';
}

export function bookPercent(b: Book): number {
  if (bookStatus(b) === 'finished') return 100;
  if (!b.wordCount) return 0;
  return Math.min(100, Math.floor((b.progressWordIndex / b.wordCount) * 100));
}

export const RECENT_DAYS = 14;
export function isRecentlyAdded(b: Book, now = Date.now()): boolean {
  return now - b.addedAt < RECENT_DAYS * 86400000;
}
