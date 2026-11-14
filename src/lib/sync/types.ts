import type { Book, ReadingLog, ReadingPrefs, AppearancePrefs, Shelf, ThemeMode, Palette } from '../../types';
import type { Database } from '../../types/supabase';

export type { Database };

export type SyncTable = Exclude<keyof Database['public']['Tables'], 'profiles'>;

/** Per-entity change marker kept by the caller. `updatedAt` is an ISO timestamp. */
export interface SyncStamp {
  updatedAt: string;
  /** Local tombstone: the entity was deleted on this device */
  deleted?: boolean;
}

/**
 * Stamp keys:
 *  book:{id} shelf:{id} bookshelf:{bookId}:{shelfId} bookmark:{bookId}:{wordIndex}
 *  progress:{bookId} session:{bookId}:{YYYY-MM-DD} prefs
 */
export type SyncStamps = Record<string, SyncStamp>;

export interface BookFileRef {
  contentHash: string | null;
  storagePath: string | null;
}

export interface SyncPrefs {
  readingPrefs: ReadingPrefs;
  appearancePrefs: AppearancePrefs;
  theme: ThemeMode;
  palette: Palette;
}

/** The synced slice of the local store plus change stamps. */
export interface LocalSnapshot {
  books: Book[];
  shelves: Shelf[];
  prefs: SyncPrefs;
  readingLog: ReadingLog;
  /** Cloud file references per book id */
  bookFiles: Record<string, BookFileRef>;
  stamps: SyncStamps;
}

export interface SyncResult {
  snapshot: LocalSnapshot;
  /** Pass back as `lastSyncedAt` next time. Server-clock timestamp (or the input if nothing was pulled). */
  cursor: string | null;
  pulled: number;
  pushed: number;
}

/** A row-level record in the flat model used for conflict resolution. */
export interface FlatRecord {
  table: SyncTable;
  key: string;
  /** Full row for live records; primary-key columns only for local tombstones */
  row: Record<string, unknown>;
  deleted: boolean;
  /** Last-modified time, ms since epoch */
  at: number;
  /** Local record changed since the cursor (only meaningful for local records) */
  dirty: boolean;
}
