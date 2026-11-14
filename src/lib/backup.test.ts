import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { useAppStore } from '../store/appStore';
import { BACKUP_VERSION, BackupError, exportBackup, inspectBackup, restoreBackup, type ContentIO } from './backup';
import type { Book, BookContent } from '../types';

function memoryIO(): ContentIO & { contents: Map<string, BookContent>; covers: Map<string, Blob> } {
  const contents = new Map<string, BookContent>();
  const covers = new Map<string, Blob>();
  return {
    contents,
    covers,
    loadContent: async (id) => contents.get(id),
    loadCover: async (id) => covers.get(id),
    saveContent: async (c) => void contents.set(c.bookId, c),
    saveCover: async (id, b) => void covers.set(id, b),
    deleteBook: async (id) => void (contents.delete(id), covers.delete(id)),
  };
}

const mkBook = (id: string, title: string, over: Partial<Book> = {}): Book => ({
  id,
  title,
  author: 'A. Writer',
  format: 'txt',
  sizeBytes: 100,
  wordCount: 4,
  chapters: [{ title: 'Beginning', startWord: 0 }],
  progressWordIndex: 0,
  lastReadAt: null,
  addedAt: 1000,
  finishedAt: null,
  shelves: [],
  tags: [],
  description: '',
  hasCover: false,
  coverHue: 10,
  bookmarks: [],
  ...over,
});

const content = (id: string): BookContent => ({
  bookId: id,
  words: ['one', 'two', 'three', 'four.'],
  paragraphStarts: [0],
  images: [],
});

function seed(io: ReturnType<typeof memoryIO>) {
  const a = mkBook('a', 'Alpha', { progressWordIndex: 2, shelves: ['fiction'], bookmarks: [1] as never });
  const b = mkBook('b', 'Beta', { hasCover: true, wordCount: 4 });
  useAppStore.setState({
    books: [a, b],
    shelves: [{ id: 'fiction', name: 'Fiction', color: 'red' }],
    readingLog: { '2026-01-01': { a: { ms: 5, words: 3 } as never } },
  });
  io.contents.set('a', content('a'));
  io.contents.set('b', content('b'));
  io.covers.set('b', new Blob(['cover-bytes']));
}

beforeEach(() => useAppStore.setState({ books: [], shelves: [], readingLog: {} }));

describe('backup', () => {
  it('round-trips books, shelves, progress and content into an empty store', async () => {
    const src = memoryIO();
    seed(src);
    const before = useAppStore.getState();
    const expected = { books: before.books, shelves: before.shelves, log: before.readingLog };
    const file = await exportBackup(undefined, src);

    useAppStore.setState({ books: [], shelves: [], readingLog: {} });
    const dst = memoryIO();
    const res = await restoreBackup(file, 'replace', undefined, dst);

    expect(res).toEqual({ added: 2, skipped: 0 });
    const after = useAppStore.getState();
    expect(after.books).toEqual(expected.books);
    expect(after.shelves).toEqual(expected.shelves);
    expect(after.readingLog).toEqual(expected.log);
    expect(dst.contents.get('a')).toEqual(content('a'));
    expect(dst.contents.get('b')).toEqual(content('b'));
    expect(await dst.covers.get('b')!.text()).toBe('cover-bytes');
  });

  it('merge skips duplicates and keeps existing books', async () => {
    const src = memoryIO();
    seed(src);
    const file = await exportBackup(undefined, src);
    useAppStore.setState({ books: [mkBook('a', 'Alpha', { progressWordIndex: 3 })] });
    const dst = memoryIO();
    const res = await restoreBackup(file, 'merge', undefined, dst);
    expect(res).toEqual({ added: 1, skipped: 1 });
    const books = useAppStore.getState().books;
    expect(books.map((b) => b.id).sort()).toEqual(['a', 'b']);
    expect(books.find((b) => b.id === 'a')!.progressWordIndex).toBe(3);
  });

  it('rejects an unknown manifest version with a clear message', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ app: 'readable-backup', version: BACKUP_VERSION + 1, bookCount: 0 }));
    zip.file('store.json', '{}');
    const file = await zip.generateAsync({ type: 'blob' });
    await expect(inspectBackup(file)).rejects.toThrow(/newer version/);
    await expect(restoreBackup(file, 'merge', undefined, memoryIO())).rejects.toBeInstanceOf(BackupError);
  });

  it('rejects files that are not backups', async () => {
    await expect(inspectBackup(new Blob(['nope']))).rejects.toThrow(/isn’t a Readable backup/);
  });
});
