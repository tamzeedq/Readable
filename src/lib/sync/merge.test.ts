import { describe, expect, it } from 'vitest';
import type { Tables } from '../../types/supabase';
import type { LocalSnapshot } from './types';
import { buildSnapshot, flattenLocal, flattenRemote, normalizeSnapshot, resolve } from './merge';
import { bookToRow } from './mapping';
import { toUuid } from './ids';
import { emptySnapshot, makeBook } from './testUtils';

const U = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const T0 = '2026-03-01T00:00:00.000Z';
const T1 = '2026-03-02T00:00:00.000Z';
const T2 = '2026-03-03T00:00:00.000Z';
const CURSOR = T0;

const remoteBook = (title: string, updated_at: string, deleted_at: string | null = null): Tables<'books'> =>
  ({ ...bookToRow(makeBook(B, { title }), U), created_at: T0, updated_at, deleted_at }) as Tables<'books'>;

const remoteOf = (books: Tables<'books'>[]) =>
  flattenRemote({ books, shelves: [], book_shelves: [], bookmarks: [], reading_progress: [], reading_sessions: [], preferences: [], profiles: [] } as never);

const localWith = (title: string, stampAt: string, extra: Partial<LocalSnapshot> = {}): LocalSnapshot => ({
  ...emptySnapshot(), books: [makeBook(B, { title })], stamps: { [`book:${B}`]: { updatedAt: stampAt } }, ...extra,
});

const run = (local: LocalSnapshot, remote: Tables<'books'>[]) => {
  const { final, push } = resolve(flattenLocal(local, U, CURSOR), remoteOf(remote));
  return { final, push, snap: buildSnapshot(final, local) };
};

describe('last-write-wins', () => {
  it('remote newer than a dirty local edit: remote wins, nothing pushed', () => {
    const { push, snap } = run(localWith('local', T1), [remoteBook('remote', T2)]);
    expect(push.filter((p) => p.table === 'books')).toHaveLength(0);
    expect(snap.books[0].title).toBe('remote');
    expect(snap.stamps[`book:${B}`].updatedAt).toBe(T2);
  });

  it('local newer than remote: local wins and is pushed', () => {
    const { push, snap } = run(localWith('local', T2), [remoteBook('remote', T1)]);
    expect(push.filter((p) => p.table === 'books')).toHaveLength(1);
    expect(snap.books[0].title).toBe('local');
  });

  it('exact tie goes to the server', () => {
    const { push, snap } = run(localWith('local', T1), [remoteBook('remote', T1)]);
    expect(push.filter((p) => p.table === 'books')).toHaveLength(0);
    expect(snap.books[0].title).toBe('remote');
  });

  it('unchanged local (stamp not after cursor) yields to remote even if stamp looks newer than remote', () => {
    const { push, snap } = run(localWith('local', T0), [remoteBook('remote', '2026-02-01T00:00:00.000Z')]);
    expect(push.filter((p) => p.table === 'books')).toHaveLength(0);
    expect(snap.books[0].title).toBe('remote');
  });

  it('local-only dirty records are pushed; unstamped records push on first sync', () => {
    const local = { ...emptySnapshot(), books: [makeBook(B)] };
    const { push } = resolve(flattenLocal(local, U, null), []);
    expect(push.map((p) => p.table).sort()).toEqual(['books', 'preferences']);
  });

  it('new remote records are added to the front of the snapshot', () => {
    const other = { ...remoteBook('old', T1), id: '33333333-3333-4333-8333-333333333333', added_at: '2020-01-01T00:00:00Z' };
    const { snap } = run(localWith('mine', T0), [other]);
    expect(snap.books.map((b) => b.title)).toEqual(['old', 'mine']);
    expect(snap.books).toHaveLength(2);
  });

  it('keeps transient books out of sync but in the snapshot', () => {
    const local = { ...emptySnapshot(), books: [makeBook(B, { transient: true })] };
    const recs = flattenLocal(local, U, null);
    expect(recs.some((r) => r.table === 'books')).toBe(false);
    expect(buildSnapshot(resolve(recs, []).final, local).books[0].transient).toBe(true);
  });
});

describe('tombstones', () => {
  it('remote tombstone newer than local edit deletes the book locally', () => {
    const { snap } = run(localWith('local', T1), [remoteBook('x', T2, T2)]);
    expect(snap.books).toHaveLength(0);
    expect(snap.stamps[`book:${B}`]).toEqual({ updatedAt: T2, deleted: true });
  });

  it('local tombstone newer than remote is pushed as a deletion', () => {
    const local: LocalSnapshot = { ...emptySnapshot(), stamps: { [`book:${B}`]: { updatedAt: T2, deleted: true } } };
    const { push, snap } = run(local, [remoteBook('remote', T1)]);
    const p = push.find((x) => x.table === 'books')!;
    expect(p.deleted).toBe(true);
    expect(p.row).toMatchObject({ id: B, user_id: U });
    expect(snap.books).toHaveLength(0);
  });

  it('remote edit newer than a local tombstone resurrects the book', () => {
    const local: LocalSnapshot = { ...emptySnapshot(), stamps: { [`book:${B}`]: { updatedAt: T1, deleted: true } } };
    const { push, snap } = run(local, [remoteBook('remote', T2)]);
    expect(push.some((x) => x.table === 'books')).toBe(false);
    expect(snap.books.map((b) => b.title)).toEqual(['remote']);
  });

  it('a book deleted remotely drops its bookmarks and shelf links from the snapshot', () => {
    const local = localWith('local', T0, { books: [makeBook(B, { title: 'local', bookmarks: [3], shelves: [toUuid('fiction')] })] });
    const { snap } = run(normalizeSnapshot(local), [remoteBook('x', T2, T2)]);
    expect(snap.books).toHaveLength(0);
  });
});

describe('normalizeSnapshot', () => {
  it('rewrites legacy shelf ids everywhere, including stamps', () => {
    const local: LocalSnapshot = {
      ...emptySnapshot(),
      shelves: [{ id: 'fiction', name: 'Fiction', color: 'c' }],
      books: [makeBook(B, { shelves: ['fiction'] })],
      stamps: { 'shelf:fiction': { updatedAt: T1 }, [`bookshelf:${B}:fiction`]: { updatedAt: T1 } },
    };
    const n = normalizeSnapshot(local);
    const id = toUuid('fiction');
    expect(n.shelves[0].id).toBe(id);
    expect(n.books[0].shelves).toEqual([id]);
    expect(Object.keys(n.stamps).sort()).toEqual([`bookshelf:${B}:${id}`, `shelf:${id}`].sort());
  });
});
