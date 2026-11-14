import type { Book, BookFormat, Chapter, AppearancePrefs, ReadingLog, Shelf } from '../../types';
import type { Json, Tables, TablesInsert } from '../../types/supabase';
import type { BookFileRef, SyncPrefs } from './types';
import { bookmarkRowId } from './ids';

const iso = (ms: number): string => new Date(ms).toISOString();
const isoOrNull = (ms: number | null): string | null => (ms == null ? null : iso(ms));
const msOrNull = (s: string | null): number | null => (s == null ? null : Date.parse(s));

// ---- books ----------------------------------------------------------------

export function bookToRow(book: Book, userId: string, file?: BookFileRef): TablesInsert<'books'> {
  return {
    id: book.id,
    user_id: userId,
    title: book.title,
    author: book.author,
    format: book.format,
    size_bytes: book.sizeBytes,
    word_count: book.wordCount,
    chapters: book.chapters as unknown as NonNullable<Json>,
    progress_word_index: book.progressWordIndex,
    last_read_at: isoOrNull(book.lastReadAt),
    added_at: iso(book.addedAt),
    finished_at: isoOrNull(book.finishedAt),
    tags: book.tags,
    description: book.description ?? null,
    has_cover: book.hasCover,
    cover_hue: book.coverHue,
    wpm: book.wpm ?? null,
    appearance: (book.appearance ?? null) as Json | null,
    skip_images: book.skipImages ?? null,
    content_hash: file?.contentHash ?? null,
    storage_path: file?.storagePath ?? null,
    deleted_at: null,
  };
}

export function rowToBook(
  row: Tables<'books'>,
  extras: { shelves?: string[]; bookmarks?: number[]; progress?: { wordIndex: number; lastReadAt: number | null } } = {},
): Book {
  const book: Book = {
    id: row.id,
    title: row.title,
    author: row.author,
    format: row.format as BookFormat,
    sizeBytes: Number(row.size_bytes),
    wordCount: row.word_count,
    chapters: (row.chapters as unknown as Chapter[]) ?? [],
    progressWordIndex: extras.progress?.wordIndex ?? row.progress_word_index,
    lastReadAt: extras.progress ? extras.progress.lastReadAt : msOrNull(row.last_read_at),
    addedAt: Date.parse(row.added_at),
    finishedAt: msOrNull(row.finished_at),
    shelves: extras.shelves ?? [],
    tags: row.tags ?? [],
    hasCover: row.has_cover,
    coverHue: row.cover_hue,
    bookmarks: extras.bookmarks ?? [],
  };
  if (row.description != null) book.description = row.description;
  if (row.wpm != null) book.wpm = row.wpm;
  if (row.appearance != null) book.appearance = row.appearance as Partial<AppearancePrefs>;
  if (row.skip_images != null) book.skipImages = row.skip_images;
  return book;
}

export const fileRefFromRow = (row: Pick<Tables<'books'>, 'content_hash' | 'storage_path'>): BookFileRef => ({
  contentHash: row.content_hash,
  storagePath: row.storage_path,
});

// ---- shelves ----------------------------------------------------------------

export const shelfToRow = (shelf: Shelf, userId: string): TablesInsert<'shelves'> => ({
  id: shelf.id,
  user_id: userId,
  name: shelf.name,
  color: shelf.color,
  note: shelf.note ?? null,
  deleted_at: null,
});

export function rowToShelf(row: Tables<'shelves'>): Shelf {
  const s: Shelf = { id: row.id, name: row.name, color: row.color };
  if (row.note != null) s.note = row.note;
  return s;
}

// ---- book_shelves / bookmarks / progress -------------------------------------

export const bookShelfToRow = (bookId: string, shelfId: string, userId: string): TablesInsert<'book_shelves'> => ({
  user_id: userId,
  book_id: bookId,
  shelf_id: shelfId,
  deleted_at: null,
});

export const bookmarkToRow = (bookId: string, wordIndex: number, userId: string): TablesInsert<'bookmarks'> => ({
  id: bookmarkRowId(bookId, wordIndex),
  user_id: userId,
  book_id: bookId,
  word_index: wordIndex,
  deleted_at: null,
});

export const progressToRow = (book: Book, userId: string): TablesInsert<'reading_progress'> => ({
  user_id: userId,
  book_id: book.id,
  word_index: book.progressWordIndex,
  last_read_at: isoOrNull(book.lastReadAt),
});

// ---- preferences ------------------------------------------------------------

export const prefsToRow = (prefs: SyncPrefs, userId: string): TablesInsert<'preferences'> => ({
  user_id: userId,
  reading: prefs.readingPrefs as unknown as NonNullable<Json>,
  appearance: prefs.appearancePrefs as unknown as NonNullable<Json>,
  theme_mode: prefs.theme,
  palette: prefs.palette,
});

/** Applies a preferences row on top of local prefs (missing keys keep local values). */
export function applyPrefsRow(local: SyncPrefs, row: Tables<'preferences'>): SyncPrefs {
  return {
    readingPrefs: { ...local.readingPrefs, ...(row.reading as object) },
    appearancePrefs: { ...local.appearancePrefs, ...(row.appearance as object) },
    theme: (row.theme_mode as SyncPrefs['theme'] | null) ?? local.theme,
    palette: (row.palette as SyncPrefs['palette'] | null) ?? local.palette,
  };
}

// ---- reading sessions ---------------------------------------------------------

export function readingLogToRows(log: ReadingLog, userId: string): TablesInsert<'reading_sessions'>[] {
  const rows: TablesInsert<'reading_sessions'>[] = [];
  for (const [day, books] of Object.entries(log)) {
    for (const [bookId, s] of Object.entries(books)) {
      rows.push({ user_id: userId, book_id: bookId, day, ms: Math.round(s.ms), words: Math.round(s.words) });
    }
  }
  return rows;
}

export function sessionRowToLog(log: ReadingLog, row: Pick<Tables<'reading_sessions'>, 'day' | 'book_id' | 'ms' | 'words'>): void {
  (log[row.day] ??= {})[row.book_id] = { ms: Number(row.ms), words: row.words };
}

// ---- stamp keys ---------------------------------------------------------------

export const keys = {
  book: (id: string) => `book:${id}`,
  shelf: (id: string) => `shelf:${id}`,
  bookshelf: (bookId: string, shelfId: string) => `bookshelf:${bookId}:${shelfId}`,
  bookmark: (bookId: string, word: number) => `bookmark:${bookId}:${word}`,
  progress: (bookId: string) => `progress:${bookId}`,
  session: (bookId: string, day: string) => `session:${bookId}:${day}`,
  prefs: 'prefs',
};
