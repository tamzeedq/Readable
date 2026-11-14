// Change stamping: diff two states of the synced store slice and bump `stamps` for what changed.
// Pure; the store calls it from a subscription so every mutation (and delete) is stamped in one place.
import type { Book, ReadingLog } from '../../types';
import type { SyncStamps } from './types';
import { keys } from './mapping';

export interface StampSlice {
  books: Book[];
  shelves: import('../../types').Shelf[];
  readingPrefs: unknown;
  appearancePrefs: unknown;
  theme: unknown;
  palette: unknown;
  readingLog: ReadingLog;
}

const synced = (books: Book[]) => new Map(books.filter((b) => !b.transient).map((b) => [b.id, b]));

const bookMeta = (b: Book) =>
  JSON.stringify({ ...b, shelves: undefined, bookmarks: undefined, progressWordIndex: undefined, lastReadAt: undefined });

/** Returns `stamps` itself when nothing synced changed, otherwise a new object. */
export function stampChanges(prev: StampSlice, next: StampSlice, stamps: SyncStamps, now: string): SyncStamps {
  const touchedBooks = prev.books !== next.books;
  const touchedShelves = prev.shelves !== next.shelves;
  const touchedPrefs =
    prev.readingPrefs !== next.readingPrefs || prev.appearancePrefs !== next.appearancePrefs || prev.theme !== next.theme || prev.palette !== next.palette;
  const touchedLog = prev.readingLog !== next.readingLog;
  if (!touchedBooks && !touchedShelves && !touchedPrefs && !touchedLog) return stamps;

  const out: SyncStamps = { ...stamps };
  const live = (key: string) => void (out[key] = { updatedAt: now, pending: true });
  const dead = (key: string) => void (out[key] = { updatedAt: now, deleted: true, pending: true });

  if (touchedBooks) {
    const before = synced(prev.books);
    const after = synced(next.books);
    for (const [id, b] of after) {
      const p = before.get(id);
      if (p === b) continue;
      if (!p) {
        live(keys.book(id));
        if (b.progressWordIndex > 0 || b.lastReadAt) live(keys.progress(id));
        b.shelves.forEach((s) => live(keys.bookshelf(id, s)));
        b.bookmarks.forEach((w) => live(keys.bookmark(id, w)));
        continue;
      }
      if (bookMeta(p) !== bookMeta(b)) live(keys.book(id));
      if (p.progressWordIndex !== b.progressWordIndex || p.lastReadAt !== b.lastReadAt) live(keys.progress(id));
      for (const s of b.shelves) if (!p.shelves.includes(s)) live(keys.bookshelf(id, s));
      for (const s of p.shelves) if (!b.shelves.includes(s)) dead(keys.bookshelf(id, s));
      for (const w of b.bookmarks) if (!p.bookmarks.includes(w)) live(keys.bookmark(id, w));
      for (const w of p.bookmarks) if (!b.bookmarks.includes(w)) dead(keys.bookmark(id, w));
    }
    for (const id of before.keys()) if (!after.has(id)) dead(keys.book(id));
  }

  if (touchedShelves) {
    const before = new Map(prev.shelves.map((s) => [s.id, s]));
    const after = new Map(next.shelves.map((s) => [s.id, s]));
    for (const [id, s] of after) {
      const p = before.get(id);
      if (p !== s && JSON.stringify(p) !== JSON.stringify(s)) live(keys.shelf(id));
    }
    for (const id of before.keys()) if (!after.has(id)) dead(keys.shelf(id));
  }

  if (touchedPrefs) live(keys.prefs);

  if (touchedLog) {
    for (const [day, books] of Object.entries(next.readingLog)) {
      const pd = prev.readingLog[day];
      if (pd === books) continue;
      for (const [bookId, s] of Object.entries(books)) {
        const p = pd?.[bookId];
        if (!p || p.ms !== s.ms || p.words !== s.words) live(keys.session(bookId, day));
      }
    }
  }

  return Object.keys(out).length === Object.keys(stamps).length && Object.keys(out).every((k) => out[k] === stamps[k]) ? stamps : out;
}
