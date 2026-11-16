// Pure conflict resolution + snapshot (de)composition. No I/O.
import type { Book, ReadingLog, Shelf } from '../../types';
import type { Tables } from '../../types/supabase';
import type { FlatRecord, LocalSnapshot, SyncTable, SyncStamps } from './types';
import { toUuid } from './ids';
import {
  applyPrefsRow, bookmarkToRow, bookShelfToRow, bookToRow, fileRefFromRow, keys, prefsToRow,
  progressToRow, readingLogToRows, rowToBook, rowToShelf, sessionRowToLog, shelfToRow,
} from './mapping';

/** Rewrite non-UUID local ids (default shelves such as 'fiction') to stable UUIDs. */
export function normalizeSnapshot(s: LocalSnapshot): LocalSnapshot {
  const stamps: SyncStamps = {};
  for (const [k, v] of Object.entries(s.stamps)) {
    const parts = k.split(':');
    if (parts[0] === 'shelf') parts[1] = toUuid(parts[1]);
    if (parts[0] === 'bookshelf') parts[2] = toUuid(parts[2]);
    stamps[parts.join(':')] = v;
  }
  return {
    ...s,
    shelves: s.shelves.map((sh) => ({ ...sh, id: toUuid(sh.id) })),
    books: s.books.map((b) => ({ ...b, shelves: b.shelves.map(toUuid) })),
    stamps,
  };
}

const ms = (iso: string) => Date.parse(iso);

/**
 * Flatten a (normalized) local snapshot into row-level records. A record is dirty (to be pushed) when it has
 * no stamp or its stamp is `pending` — tracked locally, so device clock skew can't hide a change.
 * The sync cursor is for pulling only.
 */
export function flattenLocal(s: LocalSnapshot, userId: string): FlatRecord[] {
  const out: FlatRecord[] = [];
  const seen = new Set<string>();
  const add = (table: SyncTable, key: string, row: Record<string, unknown>) => {
    seen.add(key);
    const st = s.stamps[key];
    const at = st ? ms(st.updatedAt) : 0;
    const dirty = !st || st.pending === true;
    out.push({ table, key, row, deleted: false, at, dirty });
  };
  const synced = s.books.filter((b) => !b.transient);
  const bookIds = new Set(synced.map((b) => b.id));

  for (const sh of s.shelves) add('shelves', keys.shelf(sh.id), shelfToRow(sh, userId));
  for (const b of synced) {
    add('books', keys.book(b.id), bookToRow(b, userId, s.bookFiles[b.id]));
    if (b.progressWordIndex > 0 || b.lastReadAt) add('reading_progress', keys.progress(b.id), progressToRow(b, userId));
    for (const sid of b.shelves) add('book_shelves', keys.bookshelf(b.id, sid), bookShelfToRow(b.id, sid, userId));
    for (const w of b.bookmarks) add('bookmarks', keys.bookmark(b.id, w), bookmarkToRow(b.id, w, userId));
  }
  add('preferences', keys.prefs, prefsToRow(s.prefs, userId));
  for (const r of readingLogToRows(s.readingLog, userId)) {
    if (bookIds.has(r.book_id) || s.stamps[keys.book(r.book_id)]) add('reading_sessions', keys.session(r.book_id, r.day), r);
  }

  // Tombstones: stamped as deleted and no longer present
  for (const [key, st] of Object.entries(s.stamps)) {
    if (!st.deleted || seen.has(key)) continue;
    const p = key.split(':');
    const base = { user_id: userId };
    let rec: [SyncTable, Record<string, unknown>] | null = null;
    if (p[0] === 'book') rec = ['books', { ...base, id: p[1] }];
    else if (p[0] === 'shelf') rec = ['shelves', { ...base, id: p[1] }];
    else if (p[0] === 'bookshelf') rec = ['book_shelves', { ...base, book_id: p[1], shelf_id: p[2] }];
    else if (p[0] === 'bookmark') rec = ['bookmarks', { ...base, book_id: p[1], word_index: Number(p[2]) }];
    if (!rec) continue;
    const at = ms(st.updatedAt);
    out.push({ table: rec[0], key, row: rec[1], deleted: true, at, dirty: st.pending === true });
  }
  return out;
}

type RemoteRows = {
  [T in SyncTable]: Tables<T>[];
};

export function flattenRemote(r: RemoteRows): FlatRecord[] {
  const out: FlatRecord[] = [];
  const add = (table: SyncTable, key: string, row: { updated_at: string; deleted_at?: string | null }) =>
    out.push({ table, key, row: row as Record<string, unknown>, deleted: !!row.deleted_at, at: ms(row.updated_at), dirty: false });
  r.books.forEach((x) => add('books', keys.book(x.id), x));
  r.shelves.forEach((x) => add('shelves', keys.shelf(x.id), x));
  r.book_shelves.forEach((x) => add('book_shelves', keys.bookshelf(x.book_id, x.shelf_id), x));
  r.bookmarks.forEach((x) => add('bookmarks', keys.bookmark(x.book_id, x.word_index), x));
  r.reading_progress.forEach((x) => add('reading_progress', keys.progress(x.book_id), x));
  r.reading_sessions.forEach((x) => add('reading_sessions', keys.session(x.book_id, x.day), x));
  r.preferences.forEach((x) => add('preferences', keys.prefs, x));
  return out;
}

/**
 * Last-write-wins per record. A local record is pushed only if it changed since the cursor
 * and is strictly newer than the remote one (ties go to the server).
 */
export function resolve(local: FlatRecord[], remote: FlatRecord[]): { final: Map<string, FlatRecord>; push: FlatRecord[] } {
  const final = new Map<string, FlatRecord>();
  const push: FlatRecord[] = [];
  const remoteByKey = new Map(remote.map((r) => [r.key, r]));
  for (const l of local) {
    const r = remoteByKey.get(l.key);
    if (!r) {
      final.set(l.key, l);
      if (l.dirty) push.push(l);
    } else if (l.dirty && l.at > r.at) {
      final.set(l.key, l);
      push.push(l);
    } else {
      final.set(l.key, r);
    }
  }
  for (const r of remote) if (!final.has(r.key)) final.set(r.key, r);
  return { final, push };
}

/** Rebuild the snapshot from resolved records. Transient books are carried over untouched. */
export function buildSnapshot(final: Map<string, FlatRecord>, local: LocalSnapshot): LocalSnapshot {
  const recs = [...final.values()];
  const live = (table: SyncTable) => recs.filter((r) => r.table === table && !r.deleted);
  const liveShelves = live('shelves').map((r) => rowToShelf(r.row as Tables<'shelves'>));
  const shelfIds = new Set(liveShelves.map((s) => s.id));
  const localShelfOrder = new Map(local.shelves.map((s, i) => [s.id, i]));
  liveShelves.sort((a, b) => (localShelfOrder.get(a.id) ?? 1e9) - (localShelfOrder.get(b.id) ?? 1e9));

  const shelvesByBook = new Map<string, string[]>();
  for (const r of live('book_shelves')) {
    const x = r.row as { book_id: string; shelf_id: string };
    if (shelfIds.has(x.shelf_id)) (shelvesByBook.get(x.book_id) ?? shelvesByBook.set(x.book_id, []).get(x.book_id)!).push(x.shelf_id);
  }
  const marksByBook = new Map<string, number[]>();
  for (const r of live('bookmarks')) {
    const x = r.row as { book_id: string; word_index: number };
    (marksByBook.get(x.book_id) ?? marksByBook.set(x.book_id, []).get(x.book_id)!).push(x.word_index);
  }
  const progress = new Map<string, { wordIndex: number; lastReadAt: number | null }>();
  for (const r of live('reading_progress')) {
    const x = r.row as { book_id: string; word_index: number; last_read_at: string | null };
    progress.set(x.book_id, { wordIndex: x.word_index, lastReadAt: x.last_read_at ? ms(x.last_read_at) : null });
  }

  const bookFiles: LocalSnapshot['bookFiles'] = {};
  const built = new Map<string, Book>();
  for (const r of live('books')) {
    const row = r.row as Tables<'books'>;
    const order = shelfOrderIn(local.books.find((b) => b.id === row.id)?.shelves);
    const shelves = (shelvesByBook.get(row.id) ?? []).sort((a, b) => order(a) - order(b));
    built.set(row.id, rowToBook(row, {
      shelves,
      bookmarks: (marksByBook.get(row.id) ?? []).sort((a, b) => a - b),
      progress: progress.get(row.id),
    }));
    if (row.content_hash || row.storage_path) bookFiles[row.id] = fileRefFromRow(row);
  }
  const localIds = new Set(local.books.map((b) => b.id));
  const kept = local.books.flatMap((b) => (b.transient ? [b] : built.has(b.id) ? [built.get(b.id)!] : []));
  const fresh = [...built.values()].filter((b) => !localIds.has(b.id)).sort((a, b) => b.addedAt - a.addedAt);

  let prefs = local.prefs;
  const prefsRec = final.get(keys.prefs);
  if (prefsRec && !prefsRec.deleted && prefsRec.row.updated_at) prefs = applyPrefsRow(local.prefs, prefsRec.row as Tables<'preferences'>);

  const readingLog: ReadingLog = {};
  for (const r of live('reading_sessions')) sessionRowToLog(readingLog, r.row as Tables<'reading_sessions'>);

  const stamps: SyncStamps = {};
  for (const r of recs) stamps[r.key] = r.deleted ? { updatedAt: new Date(r.at).toISOString(), deleted: true } : { updatedAt: new Date(r.at).toISOString() };

  return { books: [...fresh, ...kept], shelves: liveShelves as Shelf[], prefs, readingLog, bookFiles, stamps };
}

const shelfOrderIn = (order?: string[]) => {
  const m = new Map((order ?? []).map((id, i) => [id, i]));
  return (id: string) => m.get(id) ?? 1e9;
};
