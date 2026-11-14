// Sync runner: single-flight, debounced, backs off on errors. Talks to the store and the network only
// through injected deps so it can be tested with two simulated devices.
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { Book, BookContent, ReadingLog } from '../../types';
import type { BookFileRef, LocalSnapshot, SyncResult, SyncStamps } from './types';
import { buildSnapshot, flattenLocal, normalizeSnapshot, resolve } from './merge';
import { packBookContent, unpackBookContent } from './content';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  message: string | null;
}

export type StatusStore = UseBoundStore<StoreApi<SyncStatus>>;
export const createStatusStore = (): StatusStore =>
  create<SyncStatus>(() => ({ state: 'idle', lastSyncedAt: null, message: null }));

/** The slice of app state the runner reads and writes. */
export interface SyncStoreState extends LocalSnapshot {
  syncCursor: string | null;
  syncUserId: string | null;
}
export interface SyncStoreAdapter {
  get(): SyncStoreState;
  /** Apply without stamping the change as a local edit */
  apply(patch: Partial<SyncStoreState>): void;
}

export interface RunnerDeps {
  store: SyncStoreAdapter;
  userId: () => string | null;
  syncOnce: (local: LocalSnapshot, cursor: string | null) => Promise<SyncResult>;
  files: {
    upload(args: { bookId: string; data: Blob; contentHash: string }): Promise<{ storagePath: string }>;
    download(storagePath: string): Promise<Blob>;
  };
  content: {
    load(id: string): Promise<BookContent | undefined>;
    loadCover(id: string): Promise<Blob | undefined>;
    save(c: BookContent): Promise<void>;
    saveCover(id: string, b: Blob): Promise<void>;
    remove(id: string): Promise<void>;
  };
  status?: StatusStore;
  online?: () => boolean;
  now?: () => number;
  /** Backoff base in ms (tests use a small value) */
  backoffMs?: number;
}

const MAX_BACKOFF = 5 * 60_000;

const isNetworkError = (e: unknown) => {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  return msg.includes('fetch') || msg.includes('network') || msg.includes('failed to load');
};

/**
 * Merge a sync result with edits made while the request was in flight: anything whose stamp changed
 * since `start` stays as the local version; everything else takes the synced version.
 */
export function mergeAfterSync(current: SyncStoreState, start: SyncStamps, result: LocalSnapshot, userId: string): LocalSnapshot {
  const cur = normalizeSnapshot({ ...current, bookFiles: result.bookFiles });
  const startStamps = normalizeSnapshot({ ...current, stamps: start }).stamps;
  const changed = new Set(Object.keys(cur.stamps).filter((k) => cur.stamps[k]?.updatedAt !== startStamps[k]?.updatedAt));
  if (!changed.size) return result;
  const local = flattenLocal(cur, userId, null);
  for (const l of local) if (changed.has(l.key)) l.at = Number.MAX_SAFE_INTEGER;
  const remote = flattenLocal(result, userId, null);
  const { final } = resolve(local, remote);
  const merged = buildSnapshot(final, cur);
  for (const k of changed) merged.stamps[k] = cur.stamps[k];
  return merged;
}

export function createSyncRunner(deps: RunnerDeps) {
  const status = deps.status ?? createStatusStore();
  const online = deps.online ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const now = deps.now ?? Date.now;
  let running = false;
  let queued = false;
  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;

  const set = (patch: Partial<SyncStatus>) => status.setState(patch);

  function schedule(delay: number) {
    if (!active) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), delay);
  }

  async function filePhase(synced: LocalSnapshot): Promise<number> {
    let failed = 0;
    const pushedIds = new Set(synced.books.map((b) => b.id));
    for (const book of deps.store.get().books as Book[]) {
      if (book.transient || !pushedIds.has(book.id)) continue;
      const ref = deps.store.get().bookFiles[book.id];
      try {
        const local = await deps.content.load(book.id);
        if (local && !ref?.storagePath) {
          const cover = book.hasCover ? await deps.content.loadCover(book.id) : undefined;
          const { blob, hash } = await packBookContent(local, cover);
          const { storagePath } = await deps.files.upload({ bookId: book.id, data: blob, contentHash: hash });
          const files: Record<string, BookFileRef> = { ...deps.store.get().bookFiles, [book.id]: { contentHash: hash, storagePath } };
          deps.store.apply({ bookFiles: files });
        } else if (!local && ref?.storagePath) {
          const { content, cover } = await unpackBookContent(book.id, await deps.files.download(ref.storagePath));
          await deps.content.save(content);
          if (cover) await deps.content.saveCover(book.id, cover);
        }
      } catch (e) {
        console.error('Sync file step failed', book.id, e);
        failed++;
      }
    }
    return failed;
  }

  async function runOnce(): Promise<void> {
    const userId = deps.userId();
    if (!userId) return;
    const s0 = deps.store.get();
    if (s0.syncUserId !== userId) deps.store.apply({ syncUserId: userId, syncCursor: null, bookFiles: {} });

    const start = { ...deps.store.get() }; // frozen view: adapters may return a live object
    const result = await deps.syncOnce(start, start.syncCursor);

    const before = new Set(deps.store.get().books.map((b) => b.id));
    const merged = mergeAfterSync(deps.store.get(), start.stamps, result.snapshot, userId);
    deps.store.apply({
      books: merged.books,
      shelves: merged.shelves,
      readingLog: merged.readingLog as ReadingLog,
      prefs: merged.prefs,
      bookFiles: merged.bookFiles,
      stamps: merged.stamps,
      syncCursor: result.cursor,
    });
    // Books removed by the sync (deleted elsewhere): drop their local content
    const after = new Set(merged.books.map((b) => b.id));
    for (const id of before) if (!after.has(id)) await deps.content.remove(id).catch(() => undefined);

    const failed = await filePhase(result.snapshot);
    if (failed) throw new Error(`${failed} ${failed === 1 ? 'book' : 'books'} couldn’t be transferred`);
  }

  async function syncNow(): Promise<void> {
    if (!active) return;
    if (running) {
      queued = true;
      return;
    }
    if (!online()) {
      set({ state: 'offline', message: 'Offline — will sync when you’re back online' });
      return;
    }
    running = true;
    set({ state: 'syncing', message: null });
    try {
      await runOnce();
      failures = 0;
      set({ state: 'synced', lastSyncedAt: now(), message: null });
    } catch (e) {
      failures++;
      const offline = isNetworkError(e) || !online();
      set(
        offline
          ? { state: 'offline', message: 'Can’t reach the server — will retry' }
          : { state: 'error', message: e instanceof Error ? e.message : 'Sync failed' },
      );
      schedule(Math.min(MAX_BACKOFF, (deps.backoffMs ?? 5000) * 2 ** (failures - 1)));
    } finally {
      running = false;
      if (queued) {
        queued = false;
        if (failures === 0) schedule(0);
      }
    }
  }

  return {
    status,
    /** Begin syncing (call when signed in). Runs immediately. */
    start(): Promise<void> {
      active = true;
      failures = 0;
      return syncNow();
    },
    stop() {
      active = false;
      if (timer) clearTimeout(timer);
      timer = null;
      queued = false;
      set({ state: 'idle', message: null });
    },
    syncNow,
    /** Debounced trigger after local changes */
    syncSoon(delay = 3000) {
      if (!running) schedule(delay);
      else queued = true;
    },
    /** Manual retry: resets backoff */
    retry() {
      failures = 0;
      return syncNow();
    },
    isRunning: () => running,
  };
}

export type SyncRunner = ReturnType<typeof createSyncRunner>;
