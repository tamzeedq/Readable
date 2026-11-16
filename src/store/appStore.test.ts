import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBook } from '../lib/sync/testUtils';

vi.mock('../lib/bookStorage', () => ({ deleteBookData: vi.fn(async () => undefined) }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('persisted store migration', () => {
  it('loads a v1 persisted state under v2 without losing data', async () => {
    const book = makeBook('b1', { title: 'Old book', progressWordIndex: 42, bookmarks: [7], shelves: ['fiction'] });
    const v1 = {
      books: [book],
      shelves: [{ id: 'fiction', name: 'Fiction', color: 'red' }],
      readingPrefs: { defaultWpm: 450 },
      appearancePrefs: { wordSize: 90 },
      theme: 'dark',
      palette: 'sage',
      sidebarCollapsed: true,
      readingLog: { '2026-01-01': { b1: { ms: 1000, words: 50 } } },
    };
    localStorage.setItem('readable-v1', JSON.stringify({ state: v1, version: 1 }));
    const { useAppStore } = await import('./appStore');
    const s = useAppStore.getState();
    expect(s.books).toEqual([book]);
    expect(s.shelves).toEqual(v1.shelves);
    expect(s.readingPrefs.defaultWpm).toBe(450);
    expect(s.appearancePrefs.wordSize).toBe(90);
    expect([s.theme, s.palette, s.sidebarCollapsed]).toEqual(['dark', 'sage', true]);
    expect(s.readingLog).toEqual(v1.readingLog);
    expect([s.stamps, s.bookFiles, s.syncCursor, s.syncUserId]).toEqual([{}, {}, null, null]);
  });
});

describe('v2 → v3 migration', () => {
  it('marks existing stamps pending so they are pushed', async () => {
    const stamps = { 'book:b1': { updatedAt: '2026-01-01T00:00:00.000Z' }, 'shelf:s': { updatedAt: '2026-01-01T00:00:00.000Z', deleted: true } };
    localStorage.setItem('readable-v1', JSON.stringify({ state: { books: [makeBook('b1')], shelves: [], stamps, bookFiles: {}, syncCursor: 'c', syncUserId: 'u' }, version: 2 }));
    const { useAppStore } = await import('./appStore');
    const s = useAppStore.getState();
    expect(s.books).toHaveLength(1);
    expect(s.stamps['book:b1']).toEqual({ updatedAt: '2026-01-01T00:00:00.000Z', pending: true });
    expect(s.stamps['shelf:s']).toEqual({ updatedAt: '2026-01-01T00:00:00.000Z', deleted: true, pending: true });
    expect(s.syncCursor).toBe('c');
  });
});

describe('store stamping', () => {
  it('stamps local edits and deletes, but not sync-applied changes', async () => {
    const { useAppStore, applyFromSync } = await import('./appStore');
    const st = () => useAppStore.getState();
    st().addBook(makeBook('b1'));
    st().setProgress('b1', 10);
    st().toggleBookmark('b1', 4);
    expect(Object.keys(st().stamps).sort()).toEqual(['book:b1', 'bookmark:b1:4', 'progress:b1']);

    st().removeBook('b1');
    expect(st().stamps['book:b1']?.deleted).toBe(true);

    const before = st().stamps;
    applyFromSync({ books: [makeBook('from-cloud')] });
    expect(st().stamps).toBe(before);
  });
});

describe('v3 → v4 migration', () => {
  it('loads v3 state with onboarded defaulted to false and no data loss', async () => {
    const stamps = { 'book:b1': { updatedAt: '2026-01-01T00:00:00.000Z', pending: false } };
    localStorage.setItem(
      'readable-v1',
      JSON.stringify({ state: { books: [makeBook('b1', { progressWordIndex: 9 })], shelves: [], stamps, readingPrefs: { defaultWpm: 410 }, syncCursor: 'c' }, version: 3 }),
    );
    const { useAppStore } = await import('./appStore');
    const s = useAppStore.getState();
    expect(s.onboarded).toBe(false);
    expect(s.books[0].progressWordIndex).toBe(9);
    expect(s.readingPrefs.defaultWpm).toBe(410);
    expect(s.stamps['book:b1']).toEqual(stamps['book:b1']);
    expect(s.syncCursor).toBe('c');
  });

  it('persists onboarded', async () => {
    const { useAppStore } = await import('./appStore');
    useAppStore.getState().setOnboarded(true);
    expect(JSON.parse(localStorage.getItem('readable-v1')!).state.onboarded).toBe(true);
  });
});
