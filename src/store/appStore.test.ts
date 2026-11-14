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
