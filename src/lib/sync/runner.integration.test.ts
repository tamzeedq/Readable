// @vitest-environment node
// Two devices for one real user against the dev Supabase, driven through the sync runner.
// Skipped unless SUPABASE_URL and SUPABASE_ANON_KEY are set. Test user: sync-*@test.invalid (cleaned up like integration.test.ts).
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { BookContent } from '../../types';
import type { SyncClient } from './engine';
import { syncOnce } from './engine';
import { downloadBookFile, uploadBookFile } from './files';
import { stampChanges, type StampSlice } from './stamps';
import { createStatusStore, createSyncRunner, type SyncStoreState } from './runner';
import { emptySnapshot, makeBook } from './testUtils';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY; // optional: auth-user cleanup only
const dbUrl = process.env.DATABASE_URL; // optional fallback for cleanup
const enabled = Boolean(url && anon);

const run = Math.random().toString(36).slice(2, 10);
const email = `sync-${run}-runner@test.invalid`;
const PASSWORD = `Pw-${run}-Aa1!`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)('sync runner against Supabase (two devices, one user)', () => {
  let userId = '';
  let ca: SyncClient;
  let cb: SyncClient;

  function device(client: SyncClient) {
    const state: SyncStoreState = { ...emptySnapshot(), syncCursor: null, syncUserId: null };
    const contents = new Map<string, BookContent>();
    const slice = (): StampSlice => ({
      books: state.books, shelves: state.shelves, readingLog: state.readingLog,
      readingPrefs: state.prefs.readingPrefs, appearancePrefs: state.prefs.appearancePrefs, theme: state.prefs.theme, palette: state.prefs.palette,
    });
    const edit = (fn: () => void) => {
      const prev = slice();
      fn();
      state.stamps = stampChanges(prev, slice(), state.stamps, new Date().toISOString());
    };
    const runner = createSyncRunner({
      store: { get: () => state, apply: (p) => void Object.assign(state, p) },
      status: createStatusStore(),
      userId: () => userId,
      syncOnce: (l, c) => syncOnce(client, l, c),
      files: {
        upload: ({ bookId, data, contentHash }) => uploadBookFile(client, { bookId, data, contentHash, contentType: 'application/zip' }),
        download: (p) => downloadBookFile(client, p),
      },
      content: {
        load: async (id) => contents.get(id),
        loadCover: async () => undefined,
        save: async (c) => void contents.set(c.bookId, c),
        saveCover: async () => undefined,
        remove: async (id) => void contents.delete(id),
      },
      online: () => true,
    });
    return { state, contents, edit, runner };
  }

  beforeAll(async () => {
    ca = createClient<Database>(url!, anon!, opts);
    const { data, error } = await ca.auth.signUp({ email, password: PASSWORD });
    if (error || !data.user || !data.session) throw error ?? new Error('signUp returned no session (email confirmation on?)');
    userId = data.user.id;
    cb = createClient<Database>(url!, anon!, opts);
    const r = await cb.auth.signInWithPassword({ email, password: PASSWORD });
    if (r.error) throw r.error;
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    await ca?.storage.from('books').remove([`${userId}/${BOOK}`]).catch(() => undefined);
    for (const c of [ca].filter(Boolean)) {
      for (const t of ['books', 'shelves', 'preferences'] as const) {
        await c.from(t).delete().not(t === 'preferences' ? 'user_id' : 'id', 'is', null).then(() => undefined, () => undefined);
      }
    }
    if (service) {
      const admin = createClient<Database>(url!, service, opts);
      await admin.auth.admin.deleteUser(userId);
    } else if (dbUrl) {
      try {
        execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', `delete from auth.users where email like 'sync-${run}-%@test.invalid'`], { stdio: 'pipe' });
      } catch {
        console.warn(`Could not delete test auth user ${email}; leaving it in the dev DB`);
      }
    } else {
      console.warn(`No service key or DATABASE_URL: leaving test auth user ${email} in the dev DB`);
    }
  }, 60_000);

  const BOOK = crypto.randomUUID();

  it('book + progress + content from A reach B; a delete on B removes it on A', async () => {
    const A = device(ca);
    const B = device(cb);
    const content: BookContent = { bookId: BOOK, words: ['one', 'two', 'three.'], paragraphStarts: [0], images: [] };
    A.contents.set(BOOK, content);
    A.edit(() => (A.state.books = [makeBook(BOOK, { title: 'Cross-device', wordCount: 3, progressWordIndex: 2, lastReadAt: Date.now(), bookmarks: [1] })]));

    await A.runner.start();
    expect(A.runner.status.getState().state).toBe('synced');
    await B.runner.start();
    expect(B.runner.status.getState().state).toBe('synced');

    const onB = B.state.books.find((b) => b.id === BOOK)!;
    expect(onB.title).toBe('Cross-device');
    expect(onB.progressWordIndex).toBe(2);
    expect(onB.bookmarks).toEqual([1]);
    expect(B.contents.get(BOOK)?.words).toEqual(content.words);

    B.edit(() => (B.state.books = B.state.books.filter((b) => b.id !== BOOK)));
    await B.runner.syncNow();
    await A.runner.syncNow();
    expect(A.state.books.find((b) => b.id === BOOK)).toBeUndefined();
    expect(A.contents.has(BOOK)).toBe(false);
  }, 60_000);
});
