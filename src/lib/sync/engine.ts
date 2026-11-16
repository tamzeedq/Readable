import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../../types/supabase';
import type { FlatRecord, LocalSnapshot, SyncResult, SyncTable } from './types';
import { buildSnapshot, flattenLocal, flattenRemote, normalizeSnapshot, resolve } from './merge';

export type SyncClient = SupabaseClient<Database>;

export class SyncError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'SyncError';
  }
}

const PAGE = 1000;
const BATCH = 500;

/** Parents before children so foreign keys hold. */
const TABLES: SyncTable[] = ['shelves', 'books', 'book_shelves', 'reading_progress', 'bookmarks', 'reading_sessions', 'preferences'];

const PK: Record<SyncTable, string[]> = {
  shelves: ['id'],
  books: ['id'],
  book_shelves: ['book_id', 'shelf_id'],
  reading_progress: ['book_id'],
  bookmarks: ['book_id', 'word_index'],
  reading_sessions: ['book_id', 'day'],
  preferences: ['user_id'],
};
const HAS_TOMBSTONE = new Set<SyncTable>(['shelves', 'books', 'book_shelves', 'bookmarks']);

// The table name is dynamic, so the typed query builder is bypassed here; row shapes are checked in mapping.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (client: SyncClient, t: SyncTable): any => client.from(t);

async function currentUserId(client: SyncClient): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error) throw new SyncError('Could not read session', error);
  const id = data.session?.user.id;
  if (!id) throw new SyncError('Not signed in');
  return id;
}

async function pullTable(client: SyncClient, t: SyncTable, cursor: string | null): Promise<Tables<SyncTable>[]> {
  const rows: Tables<SyncTable>[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = table(client, t).select('*');
    if (cursor) q = q.gt('updated_at', cursor);
    q = q.order('updated_at', { ascending: true });
    for (const c of PK[t]) q = q.order(c, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new SyncError(`Pull ${t} failed: ${error.message}`, error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Pushes records; returns server updated_at (ms) by record key for rows the server confirmed. */
async function pushRecords(client: SyncClient, t: SyncTable, recs: FlatRecord[]): Promise<Map<string, number>> {
  const confirmed = new Map<string, number>();
  const confirm = (rows: Tables<SyncTable>[] | null) => {
    for (const rec of flattenRemote(rowsByTable(t, rows ?? []))) confirmed.set(rec.key, rec.at);
  };
  const upserts = recs.filter((r) => !r.deleted);
  for (let i = 0; i < upserts.length; i += BATCH) {
    const batch = upserts.slice(i, i + BATCH).map((r) => r.row);
    const { data, error } = await table(client, t).upsert(batch, { onConflict: PK[t].join(',') }).select();
    if (error) throw new SyncError(`Push ${t} failed: ${error.message}`, error);
    confirm(data);
  }
  // Tombstones are updates, not upserts: they must not create rows that never existed.
  for (const r of recs.filter((x) => x.deleted)) {
    if (!HAS_TOMBSTONE.has(t)) continue;
    const match = Object.fromEntries(PK[t].map((c) => [c, r.row[c]]));
    const { data, error } = await table(client, t).update({ deleted_at: new Date(r.at).toISOString() }).match(match).select();
    if (error) throw new SyncError(`Push ${t} tombstone failed: ${error.message}`, error);
    confirm(data);
  }
  return confirmed;
}

function rowsByTable(t: SyncTable, rows: Tables<SyncTable>[]) {
  const empty = { books: [], shelves: [], book_shelves: [], bookmarks: [], reading_progress: [], reading_sessions: [], preferences: [], profiles: [] };
  return { ...empty, [t]: rows } as unknown as Parameters<typeof flattenRemote>[0];
}

/**
 * One pull → resolve (last-write-wins by updated_at, tombstones honoured) → push round.
 * `lastSyncedAt` is the cursor returned by the previous call (null = first sync).
 * Local changes are detected via `snapshot.stamps` (`pending` flag, or no stamp); the cursor only limits the pull.
 * Non-UUID local ids (e.g. default shelves) are rewritten to stable UUIDs in the returned snapshot.
 */
export async function syncOnce(client: SyncClient, local: LocalSnapshot, lastSyncedAt: string | null): Promise<SyncResult> {
  const userId = await currentUserId(client);
  const snap = normalizeSnapshot(local);

  const pulled: Record<string, Tables<SyncTable>[]> = {};
  for (const t of TABLES) pulled[t] = await pullTable(client, t, lastSyncedAt);
  const remote = flattenRemote({ ...pulled, profiles: [] } as unknown as Parameters<typeof flattenRemote>[0]);

  const { final, push } = resolve(flattenLocal(snap, userId), remote);

  let cursor = lastSyncedAt;
  for (const r of remote) {
    const ts = (r.row as { updated_at: string }).updated_at;
    if (!cursor || Date.parse(ts) > Date.parse(cursor) || (Date.parse(ts) === Date.parse(cursor) && ts > cursor)) cursor = ts;
  }
  const cursorMs = cursor ? Date.parse(cursor) : 0;

  let pushed = 0;
  for (const t of TABLES) {
    const recs = push.filter((r) => r.table === t);
    if (!recs.length) continue;
    const confirmed = await pushRecords(client, t, recs);
    for (const r of recs) {
      // Unconfirmed (tombstone for a row the server never had): don't leave it permanently dirty
      r.at = confirmed.get(r.key) ?? Math.min(r.at, cursorMs);
      pushed++;
    }
  }

  return { snapshot: buildSnapshot(final, snap), cursor, pulled: remote.length, pushed };
}
