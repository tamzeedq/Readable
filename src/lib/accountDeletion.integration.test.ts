// @vitest-environment node
// Runs against the dev Supabase when SUPABASE_URL and SUPABASE_ANON_KEY are set (skipped otherwise). Anon key only.
// If DATABASE_URL is set the test also confirms rows/objects are gone with psql (read-only).
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { deleteAccountWith, getStorageUsageWith } from './auth';
import { hashFile, uploadBookFile } from './sync/files';
import { syncOnce } from './sync/engine';
import { emptySnapshot, makeBook } from './sync/testUtils';
import { toUuid } from './sync/ids';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const dbUrl = process.env.DATABASE_URL;
const psql = (sql: string) => execFileSync('psql', [dbUrl!, '-tA', '-c', sql], { encoding: 'utf8' }).trim();

describe.skipIf(!url || !anon)('account deletion against Supabase', () => {
  it('deletes the auth user, rows and storage objects; local library is untouched', async () => {
    const client = createClient<Database>(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } });
    const run = Math.random().toString(36).slice(2, 10);
    const email = `acctdel-${run}@test.invalid`;
    const password = `Pw-${run}-Aa1!`;
    const { data, error } = await client.auth.signUp({ email, password });
    if (error || !data.user || !data.session) throw error ?? new Error('no session (email confirmation on?)');
    const uid = data.user.id;

    // A local library that must survive
    const localBook = makeBook(toUuid('acctdel-book'), { title: 'Mine' });
    const local = { ...emptySnapshot(), books: [localBook] };
    const localBefore = structuredClone(local);

    // Sync the book and its file
    const stamped = { ...local, stamps: { [`book:${localBook.id}`]: { updatedAt: new Date().toISOString(), pending: true } } };
    await syncOnce(client, stamped, null);
    const bytes = new TextEncoder().encode(`file-${run}`);
    await uploadBookFile(client, { bookId: localBook.id, data: bytes, contentHash: await hashFile(bytes) });
    const usage = await getStorageUsageWith(client);
    expect(usage.usedBytes).toBeGreaterThan(0);
    expect(usage.limitBytes).toBe(1073741824);
    if (dbUrl) {
      expect(psql(`select count(*) from storage.objects where bucket_id='books' and name like '${uid}/%'`)).toBe('1');
      expect(psql(`select count(*) from public.books where user_id='${uid}'`)).toBe('1');
    }

    await deleteAccountWith(client);

    // Account is gone: signing in fails
    const again = createClient<Database>(url!, anon!, { auth: { persistSession: false } });
    const { error: signInErr } = await again.auth.signInWithPassword({ email, password });
    expect(signInErr).not.toBeNull();
    if (dbUrl) {
      expect(psql(`select count(*) from auth.users where id='${uid}'`)).toBe('0');
      expect(psql(`select count(*) from public.books where user_id='${uid}'`)).toBe('0');
      expect(psql(`select count(*) from storage.objects where bucket_id='books' and name like '${uid}/%'`)).toBe('0');
    }
    expect(local).toEqual(localBefore); // local library untouched
  }, 60_000);
});
