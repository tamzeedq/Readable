// @vitest-environment node
// Runs against the dev Supabase when SUPABASE_URL and SUPABASE_ANON_KEY are set (skipped otherwise).
// Users are created with auth.signUp (email confirmation is off on dev) and named sync-*@test.invalid.
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { LocalSnapshot } from './types';
import type { SyncClient } from './engine';
import { syncOnce } from './engine';
import { deleteBookFile, downloadBookFile, hashFile, uploadBookFile } from './files';
import { emptySnapshot, makeBook } from './testUtils';
import { toUuid } from './ids';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY; // optional: only used for auth-user cleanup
const dbUrl = process.env.DATABASE_URL; // optional fallback for auth-user cleanup
const enabled = Boolean(url && anon);

const run = Math.random().toString(36).slice(2, 10);
const PASSWORD = `Pw-${run}-Aa1!`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const emailOf = (label: string) => `sync-${run}-${label}@test.invalid`;

describe.skipIf(!enabled)('sync against Supabase', () => {
  const userIds: string[] = [];
  let a1: SyncClient, a2: SyncClient, b: SyncClient; // user A device 1, user A device 2 (separate client), user B
  let userA = '';
  const objectPaths: { client: SyncClient; path: string }[] = [];

  async function signUp(label: string): Promise<{ client: SyncClient; id: string }> {
    const client = createClient<Database>(url!, anon!, opts);
    const { data, error } = await client.auth.signUp({ email: emailOf(label), password: PASSWORD });
    if (error || !data.user || !data.session) throw error ?? new Error('signUp returned no session (email confirmation on?)');
    userIds.push(data.user.id);
    return { client, id: data.user.id };
  }

  beforeAll(async () => {
    const A = await signUp('a');
    userA = A.id;
    a1 = A.client;
    a2 = createClient<Database>(url!, anon!, opts);
    const { error } = await a2.auth.signInWithPassword({ email: emailOf('a'), password: PASSWORD });
    if (error) throw error;
    b = (await signUp('b')).client;
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    // 1. Each user removes its own storage objects and rows through its own session.
    for (const { client, path } of objectPaths) await client.storage.from('books').remove([path]).catch(() => undefined);
    for (const c of [a1, b].filter(Boolean)) {
      for (const t of ['books', 'shelves', 'preferences'] as const) {
        // books cascade to progress, bookmarks, sessions, book_shelves
        await c.from(t).delete().not(t === 'preferences' ? 'user_id' : 'id', 'is', null).then(() => undefined, () => undefined);
      }
    }
    // 2. Remove the auth users: admin API if available, else psql via DATABASE_URL, else leave them (sync-*@test.invalid).
    if (service) {
      const admin = createClient<Database>(url!, service, opts);
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
    } else if (dbUrl) {
      try {
        execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', `delete from auth.users where email like 'sync-${run}-%@test.invalid'`], { stdio: 'pipe' });
      } catch {
        console.warn(`Could not delete test auth users sync-${run}-*@test.invalid; leaving them in the dev DB`);
      }
    } else {
      console.warn(`No service key or DATABASE_URL: leaving test auth users sync-${run}-*@test.invalid in the dev DB`);
    }
  }, 60_000);

  const BOOK1 = crypto.randomUUID();
  const BOOK2 = crypto.randomUUID();
  let deviceA: LocalSnapshot;
  let cursorA: string | null = null;

  it('syncs a library from device A to an empty device B (same user), and user B2 sees nothing', async () => {
    const now = Date.now();
    deviceA = {
      ...emptySnapshot(),
      shelves: [{ id: 'fiction', name: 'Fiction', color: 'oklch(0.5 0.08 20)' }],
      books: [
        makeBook(BOOK1, { title: 'First', progressWordIndex: 42, lastReadAt: now, shelves: ['fiction'], bookmarks: [7, 99] }),
        makeBook(BOOK2, { title: 'Second' }),
      ],
      readingLog: { '2026-03-01': { [BOOK1]: { ms: 60000, words: 300 } } },
    };
    deviceA.prefs.theme = 'dark';
    const first = await syncOnce(a1, deviceA, null);
    expect(first.pushed).toBeGreaterThan(0);
    cursorA = first.cursor;
    deviceA = first.snapshot;
    expect(deviceA.shelves[0].id).toBe(toUuid('fiction'));

    const deviceB = await syncOnce(a2, emptySnapshot(), null);
    const byId = new Map(deviceB.snapshot.books.map((x) => [x.id, x]));
    expect(byId.get(BOOK1)).toMatchObject({ title: 'First', progressWordIndex: 42, bookmarks: [7, 99], shelves: [toUuid('fiction')] });
    expect(byId.get(BOOK2)?.title).toBe('Second');
    expect(deviceB.snapshot.shelves.map((s) => s.name)).toEqual(['Fiction']);
    expect(deviceB.snapshot.readingLog['2026-03-01'][BOOK1]).toEqual({ ms: 60000, words: 300 });
    expect(deviceB.snapshot.prefs.theme).toBe('dark');

    const other = await syncOnce(b, emptySnapshot(), null);
    expect(other.snapshot.books).toHaveLength(0);
    expect(other.snapshot.shelves).toHaveLength(0);
    expect(other.snapshot.readingLog).toEqual({});
  }, 60_000);

  it('propagates edits and tombstones between devices', async () => {
    const dev2 = await syncOnce(a2, emptySnapshot(), null);
    let snap2 = dev2.snapshot;
    // device 2 deletes BOOK2 and edits BOOK1's title
    snap2 = {
      ...snap2,
      books: snap2.books.filter((x) => x.id !== BOOK2).map((x) => (x.id === BOOK1 ? { ...x, title: 'First (edited)' } : x)),
      stamps: {
        ...snap2.stamps,
        [`book:${BOOK2}`]: { updatedAt: new Date().toISOString(), deleted: true, pending: true },
        [`book:${BOOK1}`]: { updatedAt: new Date().toISOString(), pending: true },
      },
    };
    const pushed = await syncOnce(a2, snap2, dev2.cursor);
    expect(pushed.snapshot.books.map((x) => x.id)).toEqual([BOOK1]);

    const back = await syncOnce(a1, deviceA, cursorA);
    expect(back.snapshot.books.map((x) => x.title)).toEqual(['First (edited)']);
    expect(back.snapshot.stamps[`book:${BOOK2}`].deleted).toBe(true);
    // a further sync with the new cursor is a no-op push-wise
    const again = await syncOnce(a1, back.snapshot, back.cursor);
    expect(again.snapshot.books.map((x) => x.title)).toEqual(['First (edited)']);
  }, 60_000);

  it('skips upload when the content hash already exists, and enforces storage delete policy', async () => {
    const bytes = new TextEncoder().encode(`book file ${run}`);
    const hash = await hashFile(bytes);
    const BOOK3 = crypto.randomUUID();
    const BOOK4 = crypto.randomUUID();
    const snap = { ...emptySnapshot(), books: [makeBook(BOOK3), makeBook(BOOK4)] };
    await syncOnce(a1, snap, null);

    const first = await uploadBookFile(a1, { bookId: BOOK3, data: bytes, contentHash: hash });
    expect(first.uploaded).toBe(true);
    expect(first.storagePath).toBe(`${userA}/${BOOK3}`);
    objectPaths.push({ client: a1, path: first.storagePath });

    const dup = await uploadBookFile(a1, { bookId: BOOK4, data: bytes, contentHash: hash });
    expect(dup.uploaded).toBe(false);
    expect(dup.storagePath).toBe(first.storagePath);

    const blob = await downloadBookFile(a1, first.storagePath);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);

    // another user cannot read or delete it
    await expect(downloadBookFile(b, first.storagePath)).rejects.toThrow();
    expect(await deleteBookFile(b, first.storagePath)).toBe(false);
    expect((await downloadBookFile(a1, first.storagePath)).size).toBe(bytes.length);

    // shared object is kept while another live book references it
    expect(await deleteBookFile(a1, first.storagePath, BOOK3)).toBe(false);
    // owner delete works once unreferenced
    await a1.from('books').update({ deleted_at: new Date().toISOString() }).eq('id', BOOK4);
    expect(await deleteBookFile(a1, first.storagePath, BOOK3)).toBe(true);
    await expect(downloadBookFile(a1, first.storagePath)).rejects.toThrow();
  }, 60_000);
});
