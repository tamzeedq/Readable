// App wiring for cloud sync: starts the runner when signed in, stops it when signed out.
// Does nothing (and makes no network calls) when Supabase isn't configured or nobody is signed in.
import { applyFromSync, useAppStore } from '../../store/appStore';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { deleteBookData, loadBookContent, loadCover, saveBookContent, saveCover } from '../bookStorage';
import { syncOnce } from './engine';
import { uploadBookFile, downloadBookFile, deleteBookFile } from './files';
import { createSyncRunner, type DeleteQueue, createStatusStore, type SyncRunner, type SyncStoreAdapter } from './runner';

export const useSyncStatus = createStatusStore();

const DELETE_QUEUE_STORAGE_NAME = 'readable.sync.pendingFileDeletes';
const deleteQueue: DeleteQueue = {
  load: () => {
    try {
      return JSON.parse(localStorage.getItem(DELETE_QUEUE_STORAGE_NAME) ?? '[]');
    } catch {
      return [];
    }
  },
  save: (items) => {
    try {
      if (items.length) localStorage.setItem(DELETE_QUEUE_STORAGE_NAME, JSON.stringify(items));
      else localStorage.removeItem(DELETE_QUEUE_STORAGE_NAME);
    } catch {
      /* storage unavailable: retry is best-effort */
    }
  },
};

let runner: SyncRunner | null = null;
let started = false;

const INTERVAL_MS = 4 * 60_000;

const storeAdapter: SyncStoreAdapter = {
  get: () => {
    const s = useAppStore.getState();
    return {
      books: s.books,
      shelves: s.shelves,
      prefs: { readingPrefs: s.readingPrefs, appearancePrefs: s.appearancePrefs, theme: s.theme, palette: s.palette },
      readingLog: s.readingLog,
      bookFiles: s.bookFiles,
      stamps: s.stamps,
      syncCursor: s.syncCursor,
      syncUserId: s.syncUserId,
    };
  },
  apply: ({ prefs, ...rest }) => applyFromSync({ ...rest, ...prefs }),
};

function buildRunner(): SyncRunner | null {
  const client = supabase;
  if (!client) return null;
  return createSyncRunner({
    store: storeAdapter,
    status: useSyncStatus,
    deleteQueue,
    userId: () => useAuth.getState().user?.id ?? null,
    syncOnce: (local, cursor) => syncOnce(client, local, cursor),
    files: {
      upload: ({ bookId, data, contentHash }) => uploadBookFile(client, { bookId, data, contentHash, contentType: 'application/zip' }),
      download: (path) => downloadBookFile(client, path),
      remove: (path, bookId) => deleteBookFile(client, path, bookId),
    },
    content: { load: loadBookContent, loadCover, save: saveBookContent, saveCover, remove: deleteBookData },
  });
}

export function retrySync(): void {
  void runner?.retry();
}

/** Call once at startup (after initAuth). Safe to call more than once. */
export function initSync(): void {
  if (started || !supabase) return;
  started = true;
  runner = buildRunner();
  if (!runner) return;
  const r = runner;

  const onAuth = () => {
    const { status, user } = useAuth.getState();
    if (status === 'signed-in' && user) r.start();
    else if (status === 'signed-out') {
      r.stop();
      // Detach this device's sync position from the account; the local library stays.
      applyFromSync({ syncCursor: null, bookFiles: {}, syncUserId: null });
      deleteQueue.save([]);
    }
  };
  useAuth.subscribe(onAuth);
  onAuth();

  // Local edits → debounced sync. Stamps only change on real edits, never on sync results.
  useAppStore.subscribe((s, prev) => {
    if (s.stamps !== prev.stamps && useAuth.getState().status === 'signed-in') r.syncSoon();
  });
  window.addEventListener('focus', () => useAuth.getState().status === 'signed-in' && r.syncSoon(500));
  window.addEventListener('online', () => useAuth.getState().status === 'signed-in' && void r.retry());
  setInterval(() => {
    if (useAuth.getState().status === 'signed-in' && !document.hidden) void r.syncNow();
  }, INTERVAL_MS);
}
