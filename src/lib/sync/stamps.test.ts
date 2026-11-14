import { describe, expect, it } from 'vitest';
import { stampChanges, type StampSlice } from './stamps';
import { makeBook } from './testUtils';

const base = (): StampSlice => ({
  books: [], shelves: [], readingLog: {}, readingPrefs: { a: 1 }, appearancePrefs: {}, theme: 'system', palette: 'sepia',
});
const T = '2026-01-01T00:00:00.000Z';

describe('stampChanges', () => {
  it('returns the same object when nothing synced changed', () => {
    const s = base();
    const stamps = { prefs: { updatedAt: T } };
    expect(stampChanges(s, { ...s }, stamps, T)).toBe(stamps);
  });

  it('stamps a new book with its children, and ignores transient books', () => {
    const b = makeBook('b1', { progressWordIndex: 5, shelves: ['s1'], bookmarks: [3] });
    const prev0 = base();
    const out = stampChanges(prev0, { ...prev0, books: [b, makeBook('t', { transient: true })] }, {}, T);
    expect(Object.keys(out).sort()).toEqual(['book:b1', 'bookmark:b1:3', 'bookshelf:b1:s1', 'progress:b1']);
  });

  it('stamps progress only when progress changes, and tombstones removals', () => {
    const b = makeBook('b1', { shelves: ['s1'], bookmarks: [3] });
    const prev = { ...base(), books: [b] };
    const moved = stampChanges(prev, { ...prev, books: [{ ...b, progressWordIndex: 9, lastReadAt: 1 }] }, {}, T);
    expect(Object.keys(moved)).toEqual(['progress:b1']);
    const trimmed = stampChanges(prev, { ...prev, books: [{ ...b, shelves: [], bookmarks: [] }] }, {}, T);
    expect(trimmed['bookshelf:b1:s1']).toEqual({ updatedAt: T, deleted: true });
    expect(trimmed['bookmark:b1:3']).toEqual({ updatedAt: T, deleted: true });
    const gone = stampChanges(prev, { ...prev, books: [] }, {}, T);
    expect(gone['book:b1']).toEqual({ updatedAt: T, deleted: true });
  });

  it('stamps shelves, prefs and reading sessions', () => {
    const prev = base();
    const out = stampChanges(
      { ...prev, shelves: [{ id: 'x', name: 'X', color: 'red' }] },
      { ...prev, shelves: [{ id: 'y', name: 'Y', color: 'red' }], readingPrefs: { a: 2 }, readingLog: { '2026-01-01': { b1: { ms: 1, words: 1 } } } },
      {},
      T,
    );
    expect(out['shelf:x']?.deleted).toBe(true);
    expect(out['shelf:y']).toEqual({ updatedAt: T });
    expect(out.prefs).toEqual({ updatedAt: T });
    expect(out['session:b1:2026-01-01']).toEqual({ updatedAt: T });
  });
});
