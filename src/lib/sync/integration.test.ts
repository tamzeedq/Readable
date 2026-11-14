// @vitest-environment node
// Runs against the dev Supabase; skipped when SUPABASE_URL / ANON / SERVICE_ROLE keys are absent.
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
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

const run = Math.random().toString(36).slice(2, 10);
const PASSWORD = `Pw-${run}-Aa1!`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)('sync against Supabase', () => {
  const admin = enabled ? createClient<Database>(url!, service!, opts) : (null as never);
  const userIds: string[] = [];
  let a1: SyncClient, a2: SyncClient, b: SyncClient; // user A device 1, user A device 2 (separate client), user B
  let userA = '';
  const objectPaths: string[] = [];

  async function signUp(label: string): Promise<{ client: SyncClient; id: string }> {
    const email = `sync-${run}-${label}@test.invalid`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const client = createClient<Database>(url!, anon!, opts);
    const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (e2) throw e2;
    return { client, id: data.user.id };
  }

  beforeAll(async () => {
    const A = await signUp('a');
    userA = A.id;
    a1 = A.client;
    a2 = (await (async () => {
      const email = `sync-${run}-a@test.invalid`;
      const c = createClient<Database>(url!, anon!, opts);
      const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
      if (error) throw error;
      return c;
    })());
    b = (await signUp('b')).client;
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    if (objectPaths.length) await admin.storage.from('books').remove(objectPaths);
    for (const id of userIds) await admin.auth.admin.deleteUser(id); // cascades all user rows
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
        [`book:${BOOK2}`]: { updatedAt: new Date().toISOString(), deleted: true },
        [`book:${BOOK1}`]: { updatedAt: new Date().toISOString() },
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
    objectPaths.push(first.storagePath);

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
