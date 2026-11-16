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
import { stampChanges } from '../lib/sync/stamps';
import type { BookFileRef, SyncStamps } from '../lib/sync/types';

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

  /** Whether the first-run intro has been shown (persisted; reset by "Show intro again" only opens it) */
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;

  // ---- Stats (persisted) ----
  readingLog: ReadingLog;
  /** Record reading time and words for a book on today's date */
  logReading: (bookId: string, ms: number, words: number) => void;

  // ---- Cloud sync bookkeeping (persisted; see lib/sync) ----
  /** Change stamps per synced entity, incl. delete tombstones */
  stamps: SyncStamps;
  /** Cloud file references per book id (scoped to `syncUserId`) */
  bookFiles: Record<string, BookFileRef>;
  /** Server-time cursor of the last completed sync (null = never synced) */
  syncCursor: string | null;
  /** The account the cursor/bookFiles belong to */
  syncUserId: string | null;

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

/**
 * v3 → v4 adds `onboarded` (defaults to false via the store default; no data is touched).
 * v1 → v2 adds the sync bookkeeping fields. Existing data is untouched; entities with no stamp are
 * treated as changed-at-epoch, so the first sync merges them into the account without overriding it.
 */
export function migratePersisted(persisted: unknown, version: number): unknown {
  const p = (persisted ?? {}) as Record<string, unknown>;
  let out = p;
  if (version < 2) out = { ...out, stamps: {}, bookFiles: {}, syncCursor: null, syncUserId: null };
  if (version < 3) {
    // Stamps from before dirtiness was tracked locally: treat every one as not yet pushed
    const stamps = (out.stamps ?? {}) as SyncStamps;
    out = { ...out, stamps: Object.fromEntries(Object.entries(stamps).map(([k, v]) => [k, { ...v, pending: true }])) };
  }
  // v3 → v4: `onboarded` is additive; absent means false (merge keeps the store default)
  return out;
}

let applyingSync = false;

/** Apply sync results to the store without them being stamped as local edits. */
export function applyFromSync(patch: Partial<AppState>): void {
  applyingSync = true;
  try {
    useAppStore.setState(patch);
  } finally {
    applyingSync = false;
  }
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
      onboarded: false,
      setOnboarded: (onboarded) => set({ onboarded }),
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

      // ---- Cloud sync bookkeeping ----
      stamps: {},
      bookFiles: {},
      syncCursor: null,
      syncUserId: null,

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
      version: 4,
      migrate: migratePersisted,
      partialize: (s) => ({
        books: s.books,
        shelves: s.shelves,
        readingPrefs: s.readingPrefs,
        appearancePrefs: s.appearancePrefs,
        theme: s.theme,
        palette: s.palette,
        sidebarCollapsed: s.sidebarCollapsed,
        onboarded: s.onboarded,
        readingLog: s.readingLog,
        stamps: s.stamps,
        bookFiles: s.bookFiles,
        syncCursor: s.syncCursor,
        syncUserId: s.syncUserId,
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

// Stamp every local mutation (and deletion) for sync. Changes applied by the sync runner are not re-stamped.
useAppStore.subscribe((state, prev) => {
  if (applyingSync) return;
  const stamps = stampChanges(prev, state, state.stamps, new Date().toISOString());
  if (stamps !== state.stamps) useAppStore.setState({ stamps });
});

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
