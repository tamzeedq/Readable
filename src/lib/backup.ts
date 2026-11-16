// Library backup: a single .zip with a versioned manifest, the persisted store data,
// and each book's content (words, images, cover) pulled from IndexedDB.
import JSZip from 'jszip';
import { useAppStore } from '../store/appStore';
import { deleteBookData, loadBookContent, loadCover, saveBookContent, saveCover } from './bookStorage';
import type { Book, BookContent, BookImage } from '../types';

export const BACKUP_VERSION = 1;
const APP_ID = 'readable-backup';

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Where heavy book data lives; injectable so tests don't need IndexedDB. */
export interface ContentIO {
  loadContent(id: string): Promise<BookContent | undefined>;
  loadCover(id: string): Promise<Blob | undefined>;
  saveContent(c: BookContent): Promise<void>;
  saveCover(id: string, b: Blob): Promise<void>;
  deleteBook(id: string): Promise<void>;
}

const defaultIO: ContentIO = {
  loadContent: loadBookContent,
  loadCover,
  saveContent: saveBookContent,
  saveCover,
  deleteBook: deleteBookData,
};

export interface Manifest {
  app: typeof APP_ID;
  version: number;
  exportedAt: string;
  bookCount: number;
}

type StoreData = Pick<
  ReturnType<typeof useAppStore.getState>,
  'books' | 'shelves' | 'readingPrefs' | 'appearancePrefs' | 'theme' | 'palette' | 'sidebarCollapsed' | 'readingLog'
>;

export type BackupProgress = (p: { percent: number; detail: string }) => void;
const noop: BackupProgress = () => {};

function snapshot(): StoreData {
  const s = useAppStore.getState();
  return {
    books: s.books.filter((b) => !b.transient),
    shelves: s.shelves,
    readingPrefs: s.readingPrefs,
    appearancePrefs: s.appearancePrefs,
    theme: s.theme,
    palette: s.palette,
    sidebarCollapsed: s.sidebarCollapsed,
    readingLog: s.readingLog,
  };
}

export async function exportBackup(onProgress: BackupProgress = noop, io: ContentIO = defaultIO): Promise<Blob> {
  const data = snapshot();
  const zip = new JSZip();
  const manifest: Manifest = {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    bookCount: data.books.length,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('store.json', JSON.stringify(data));

  for (let i = 0; i < data.books.length; i++) {
    const book = data.books[i];
    onProgress({ percent: (i / Math.max(1, data.books.length)) * 90, detail: `adding ${book.title}` });
    const content = await io.loadContent(book.id);
    if (content) {
      const dir = `books/${book.id}/`;
      const images = [];
      for (let j = 0; j < content.images.length; j++) {
        const { blob, ...meta } = content.images[j];
        const file = `${dir}img-${j}`;
        zip.file(file, await blob.arrayBuffer());
        images.push({ ...meta, file, type: blob.type });
      }
      zip.file(`${dir}content.json`, JSON.stringify({ ...content, images }));
    }
    const cover = book.hasCover ? await io.loadCover(book.id) : undefined;
    if (cover) zip.file(`books/${book.id}/cover`, await cover.arrayBuffer());
  }
  onProgress({ percent: 92, detail: 'compressing' });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (m) =>
    onProgress({ percent: 92 + m.percent * 0.08, detail: 'compressing' }),
  );
  onProgress({ percent: 100, detail: 'done' });
  return blob;
}

async function openBackup(file: Blob): Promise<{ zip: JSZip; manifest: Manifest }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new BackupError('This isn’t a Readable backup file.');
  }
  const mf = zip.file('manifest.json');
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await mf!.async('string'));
  } catch {
    throw new BackupError('This isn’t a Readable backup file.');
  }
  if (manifest?.app !== APP_ID || typeof manifest.version !== 'number') {
    throw new BackupError('This isn’t a Readable backup file.');
  }
  if (manifest.version > BACKUP_VERSION) {
    throw new BackupError(
      `This backup was made by a newer version of Readable (backup format ${manifest.version}). Update the app to restore it.`,
    );
  }
  if (manifest.version < 1) throw new BackupError(`Unsupported backup format version ${manifest.version}.`);
  if (!zip.file('store.json')) throw new BackupError('This backup is incomplete — its library data is missing.');
  return { zip, manifest };
}

/** Validate a file and report what it contains, without changing anything. */
export async function inspectBackup(file: Blob): Promise<Manifest> {
  return (await openBackup(file)).manifest;
}

export type RestoreMode = 'merge' | 'replace';

const sameBook = (a: Book, b: Book) =>
  a.id === b.id || (a.title === b.title && a.author === b.author && a.wordCount === b.wordCount);

export async function restoreBackup(
  file: Blob,
  mode: RestoreMode,
  onProgress: BackupProgress = noop,
  io: ContentIO = defaultIO,
): Promise<{ added: number; skipped: number }> {
  const { zip } = await openBackup(file);
  let data: StoreData;
  try {
    data = JSON.parse(await zip.file('store.json')!.async('string'));
    if (!Array.isArray(data.books) || !Array.isArray(data.shelves)) throw new Error();
  } catch {
    throw new BackupError('This backup’s library data is damaged.');
  }

  const current = useAppStore.getState();
  const existing = mode === 'replace' ? [] : current.books;
  const incoming = data.books.filter((b) => !existing.some((e) => sameBook(e, b)));
  const skipped = data.books.length - incoming.length;

  // Write content first; if storage fails the store is left untouched.
  const restored: Book[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const book = incoming[i];
    onProgress({ percent: (i / Math.max(1, incoming.length)) * 95, detail: `restoring ${book.title}` });
    const dir = `books/${book.id}/`;
    const cf = zip.file(`${dir}content.json`);
    if (!cf) continue; // metadata-only entry; nothing to read
    const raw = JSON.parse(await cf.async('string')) as Omit<BookContent, 'images'> & {
      images: (Omit<BookImage, 'blob'> & { file: string; type: string })[];
    };
    const images: BookImage[] = [];
    for (const { file: f, type, ...meta } of raw.images) {
      const bytes = await zip.file(f)!.async('arraybuffer');
      images.push({ ...meta, blob: new Blob([bytes], { type }) });
    }
    await io.saveContent({ ...raw, images });
    const cover = zip.file(`${dir}cover`);
    let hasCover = false;
    if (cover) {
      try {
        await io.saveCover(book.id, new Blob([await cover.async('arraybuffer')]));
        hasCover = true;
      } catch {
        /* falls back to the typographic cover */
      }
    }
    restored.push({ ...book, hasCover });
  }

  if (mode === 'replace') {
    await Promise.all(current.books.filter((b) => !restored.some((r) => r.id === b.id)).map((b) => io.deleteBook(b.id)));
    useAppStore.setState({
      books: restored,
      shelves: data.shelves,
      readingPrefs: data.readingPrefs,
      appearancePrefs: data.appearancePrefs,
      theme: data.theme,
      palette: data.palette,
      sidebarCollapsed: data.sidebarCollapsed,
      readingLog: data.readingLog ?? {},
    });
  } else {
    const shelfIds = new Set(current.shelves.map((s) => s.id));
    const log = { ...current.readingLog };
    for (const [day, books] of Object.entries(data.readingLog ?? {})) {
      log[day] = { ...books, ...(log[day] ?? {}) };
    }
    useAppStore.setState({
      books: [...restored, ...current.books],
      shelves: [...current.shelves, ...data.shelves.filter((s) => !shelfIds.has(s.id))],
      readingLog: log,
    });
  }
  onProgress({ percent: 100, detail: 'done' });
  return { added: restored.length, skipped };
}
