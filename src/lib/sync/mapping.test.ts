import { describe, expect, it } from 'vitest';
import type { Tables } from '../../types/supabase';
import { applyPrefsRow, bookToRow, prefsToRow, readingLogToRows, rowToBook, rowToShelf, sessionRowToLog, shelfToRow } from './mapping';
import { bookmarkRowId, hashUuid, isUuid, toUuid } from './ids';
import { defaultPrefs, makeBook } from './testUtils';

const U = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const stamp = { created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

describe('book mapping', () => {
  it('round-trips every synced field', () => {
    const book = makeBook(B, {
      progressWordIndex: 321, lastReadAt: Date.UTC(2026, 5, 1), finishedAt: Date.UTC(2026, 6, 1),
      description: 'desc', wpm: 420, skipImages: true, appearance: { bionic: true, wordSize: 80 },
      shelves: ['s1'], bookmarks: [5, 9],
    });
    const row = { ...bookToRow(book, U), ...stamp } as Tables<'books'>;
    const back = rowToBook(row, { shelves: book.shelves, bookmarks: book.bookmarks });
    expect(back).toEqual(book);
  });

  it('omits optional fields that are unset', () => {
    const book = makeBook(B);
    const back = rowToBook({ ...bookToRow(book, U), ...stamp } as Tables<'books'>);
    expect(back).toEqual(book);
    expect('wpm' in back).toBe(false);
  });

  it('prefers the progress row over the denormalised book columns', () => {
    const row = { ...bookToRow(makeBook(B, { progressWordIndex: 1 }), U), ...stamp } as Tables<'books'>;
    const back = rowToBook(row, { progress: { wordIndex: 50, lastReadAt: 1000 } });
    expect(back.progressWordIndex).toBe(50);
    expect(back.lastReadAt).toBe(1000);
  });
});

describe('other mappings', () => {
  it('round-trips shelves', () => {
    const sh = { id: B, name: 'Fav', color: 'oklch(0.5 0.08 20)', note: 'n' };
    expect(rowToShelf({ ...shelfToRow(sh, U), ...stamp } as Tables<'shelves'>)).toEqual(sh);
  });

  it('round-trips preferences and keeps local values for missing keys', () => {
    const prefs = { ...defaultPrefs, theme: 'dark' as const, palette: 'moss' as const };
    const row = { ...prefsToRow(prefs, U), ...stamp } as Tables<'preferences'>;
    expect(applyPrefsRow(defaultPrefs, row)).toEqual(prefs);
    const sparse = { ...row, reading: {}, theme_mode: null } as Tables<'preferences'>;
    expect(applyPrefsRow(prefs, sparse).readingPrefs).toEqual(prefs.readingPrefs);
    expect(applyPrefsRow(prefs, sparse).theme).toBe('dark');
  });

  it('round-trips the reading log', () => {
    const log = { '2026-02-01': { [B]: { ms: 1000, words: 50 } }, '2026-02-02': { [B]: { ms: 5, words: 1 } } };
    const out = {};
    for (const r of readingLogToRows(log, U)) sessionRowToLog(out, { ...r, ms: r.ms ?? 0, words: r.words ?? 0 });
    expect(out).toEqual(log);
  });
});

describe('ids', () => {
  it('maps legacy ids deterministically to uuids and leaves uuids alone', () => {
    expect(isUuid(toUuid('fiction'))).toBe(true);
    expect(toUuid('fiction')).toBe(toUuid('fiction'));
    expect(toUuid('fiction')).not.toBe(toUuid('work'));
    expect(toUuid(B)).toBe(B);
    expect(hashUuid('x')).toMatch(/^[0-9a-f-]{36}$/);
    expect(bookmarkRowId(B, 1)).not.toBe(bookmarkRowId(B, 2));
  });
});
