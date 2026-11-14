// @vitest-environment node
// Two simulated devices sharing an in-memory "cloud" that resolves conflicts with the real merge code.
import { describe, expect, it, vi } from 'vitest';
import type { Book, BookContent } from '../../types';
import type { FlatRecord, LocalSnapshot, SyncResult } from './types';
import { buildSnapshot, flattenLocal, normalizeSnapshot, resolve } from './merge';
import { stampChanges, type StampSlice } from './stamps';
import { createSyncRunner, createStatusStore, type SyncStoreAdapter, type SyncStoreState } from './runner';
import { emptySnapshot, makeBook } from './testUtils';

const USER = '00000000-0000-4000-8000-000000000001';

function makeCloud() {
  let clock = Date.UTC(2026, 5, 1);
  const tick = () => ++clock;
  const iso = (ms: number) => new Date(ms).toISOString();
  const remote = new Map<string, FlatRecord>();
  const storage = new Map<string, Blob>();
  let calls = 0;

  async function syncOnce(local: LocalSnapshot, cursor: string | null): Promise<SyncResult> {
    calls++;
    const snap = normalizeSnapshot(local);
    const cursorMs = cursor ? Date.parse(cursor) : null;
    const pulled = [...remote.values()].filter((r) => cursorMs === null || r.at > cursorMs);
    const { final, push } = resolve(flattenLocal(snap, USER, cursor), pulled);
    let newCursor = cursor;
    for (const r of pulled) if (!newCursor || r.at > Date.parse(newCursor)) newCursor = iso(r.at);
    for (const p of push) {
      const at = tick();
      const existing = remote.get(p.key);
      const row = { ...(p.deleted ? (existing?.row ?? p.row) : p.row), updated_at: iso(at), deleted_at: p.deleted ? iso(at) : null };
      remote.set(p.key, { ...p, row, at, deleted: p.deleted, dirty: false });
      p.at = at;
    }
    return { snapshot: buildSnapshot(final, snap), cursor: newCursor, pulled: pulled.length, pushed: push.length };
  }

  const files = {
    async upload({ bookId, data, contentHash }: { bookId: string; data: Blob; contentHash: string }) {
      const storagePath = `${USER}/${bookId}`;
      storage.set(storagePath, data);
      const rec = remote.get(`book:${bookId}`)!;
      const at = tick();
      remote.set(rec.key, { ...rec, at, row: { ...rec.row, content_hash: contentHash, storage_path: storagePath, updated_at: iso(at) } });
      return { storagePath };
    },
    async download(path: string) {
      const b = storage.get(path);
      if (!b) throw new Error('missing object');
      return b;
    },
  };
  return { syncOnce, files, tick, iso, calls: () => calls };
}

type Cloud = ReturnType<typeof makeCloud>;

function makeDevice(cloud: Cloud) {
  const state: SyncStoreState = { ...emptySnapshot(), syncCursor: null, syncUserId: null };
  const contents = new Map<string, BookContent>();
  const slice = (): StampSlice => ({
    books: state.books, shelves: state.shelves, readingLog: state.readingLog,
    readingPrefs: state.prefs.readingPrefs, appearancePrefs: state.prefs.appearancePrefs, theme: state.prefs.theme, palette: state.prefs.palette,
  });
  /** A local edit: mutate, then stamp like the store subscription does */
  const edit = (fn: () => void) => {
    const prev = slice();
    fn();
    state.stamps = stampChanges(prev, slice(), state.stamps, cloud.iso(cloud.tick()));
  };
  const adapter: SyncStoreAdapter = {
    get: () => state,
    apply: (patch) => void Object.assign(state, patch),
  };
  const runner = createSyncRunner({
    store: adapter,
    status: createStatusStore(),
    userId: () => USER,
    syncOnce: (l, c) => cloud.syncOnce(l, c),
    files: cloud.files,
    content: {
      load: async (id) => contents.get(id),
      loadCover: async () => undefined,
      save: async (c) => void contents.set(c.bookId, c),
      saveCover: async () => undefined,
      remove: async (id) => void contents.delete(id),
    },
    online: () => true,
    backoffMs: 1,
  });
  const addBook = (b: Book, c: BookContent) => {
    contents.set(b.id, c);
    edit(() => (state.books = [b, ...state.books]));
  };
  return { state, contents, edit, runner, addBook };
}

const content = (id: string): BookContent => ({ bookId: id, words: ['alpha', 'beta', 'gamma.'], paragraphStarts: [0], images: [] });
const BOOK_ID = '11111111-1111-4111-8111-111111111111';

describe('two-device sync', () => {
  it('syncs a book with content and progress A → B, and a delete B → A', async () => {
    const cloud = makeCloud();
    const A = makeDevice(cloud);
    const B = makeDevice(cloud);

    A.addBook(makeBook(BOOK_ID, { title: 'Shared', wordCount: 3 }), content(BOOK_ID));
    A.edit(() => (A.state.books = A.state.books.map((b) => ({ ...b, progressWordIndex: 2, lastReadAt: 5000, bookmarks: [1] }))));
    await A.runner.start();
    expect(A.runner.status.getState().state).toBe('synced');

    await B.runner.start();
    const onB = B.state.books.find((b) => b.id === BOOK_ID)!;
    expect(onB.title).toBe('Shared');
    expect(onB.progressWordIndex).toBe(2);
    expect(onB.bookmarks).toEqual([1]);
    expect(B.contents.get(BOOK_ID)?.words).toEqual(['alpha', 'beta', 'gamma.']);

    // B reads on; A catches up
    B.edit(() => (B.state.books = B.state.books.map((b) => ({ ...b, progressWordIndex: 1, lastReadAt: 9000 }))));
    await B.runner.syncNow();
    await A.runner.syncNow();
    expect(A.state.books[0].progressWordIndex).toBe(1);

    // B deletes; A loses the book and its local content
    B.edit(() => (B.state.books = B.state.books.filter((b) => b.id !== BOOK_ID)));
    await B.runner.syncNow();
    await A.runner.syncNow();
    expect(A.state.books.find((b) => b.id === BOOK_ID)).toBeUndefined();
    expect(A.contents.has(BOOK_ID)).toBe(false);
  });

  it('keeps edits made while a sync is in flight', async () => {
    const cloud = makeCloud();
    const A = makeDevice(cloud);
    A.addBook(makeBook(BOOK_ID, { wordCount: 3 }), content(BOOK_ID));
    const slow = cloud.syncOnce;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    cloud.syncOnce = async (l, c) => {
      const res = await slow(l, c);
      await gate;
      return res;
    };
    const p = A.runner.start();
    await Promise.resolve();
    A.edit(() => (A.state.books = A.state.books.map((b) => ({ ...b, progressWordIndex: 2, lastReadAt: 7000 }))));
    release();
    await p;
    expect(A.state.books[0].progressWordIndex).toBe(2);
  });

  it('merges an existing local library into an account without losing either side', async () => {
    const cloud = makeCloud();
    const A = makeDevice(cloud);
    const B = makeDevice(cloud);
    A.addBook(makeBook(BOOK_ID, { title: 'From A' }), content(BOOK_ID));
    await A.runner.start();
    const other = '22222222-2222-4222-8222-222222222222';
    B.addBook(makeBook(other, { title: 'From B' }), content(other));
    await B.runner.start();
    await A.runner.syncNow();
    expect(B.state.books.map((b) => b.title).sort()).toEqual(['From A', 'From B']);
    expect(A.state.books.map((b) => b.title).sort()).toEqual(['From A', 'From B']);
  });

  it('backs off and reports offline/error, then recovers', async () => {
    const cloud = makeCloud();
    const A = makeDevice(cloud);
    const real = cloud.syncOnce;
    let fail = true;
    cloud.syncOnce = async (l, c) => {
      if (fail) throw new Error('boom');
      return real(l, c);
    };
    await A.runner.start();
    expect(A.runner.status.getState().state).toBe('error');
    fail = false;
    await A.runner.retry();
    expect(A.runner.status.getState().state).toBe('synced');
    A.runner.stop();
  });
});

describe('signed out / no Supabase', () => {
  it('makes no network calls and the client is absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { supabase } = await import('../supabase');
    expect(supabase).toBeNull();
    const { initSync } = await import('./app');
    initSync();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
