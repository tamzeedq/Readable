// Import pipeline: parse a file (or pasted text), store its content/cover in IndexedDB,
// and add the Book metadata to the library store.
import type { Book, BookFormat } from '../types';
import { newId, useAppStore } from '../store/appStore';
import { StorageFullError, requestPersistentStorage, saveBookContent, saveCover } from './bookStorage';
import {
  ParseError,
  UnreadableError,
  UnsupportedFormatError,
  parseEpub,
  parsePastedText,
  parsePdf,
  parseTxt,
  type ParsedBook,
  type ProgressFn,
} from './parser';

export { ParseError, UnreadableError, UnsupportedFormatError };
export type { ParseProgress } from './parser';

/** Accept string for the file picker */
/** Largest file we try to import (in-browser parsing of bigger files risks running out of memory) */
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export const IMPORT_ACCEPT = '.epub,.pdf,.txt,.text,.md,.markdown';

/** Deterministic 0–359 hue from a title (FNV-1a) */
export function hueFromTitle(title: string): number {
  let h = 0x811c9dc5;
  const s = title.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 360;
}

export function detectFormat(file: File): Exclude<BookFormat, 'paste'> {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop()! : '';
  if (ext === 'epub' || file.type === 'application/epub+zip') return 'epub';
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if (['txt', 'text', 'md', 'markdown'].includes(ext) || file.type === 'text/plain' || file.type === 'text/markdown') return 'txt';
  if (ext === 'mobi' || ext === 'azw' || ext === 'azw3') {
    throw new UnsupportedFormatError('Kindle files aren’t supported — convert to EPUB first');
  }
  if (ext === 'doc' || ext === 'docx') throw new UnsupportedFormatError('Word documents aren’t supported yet — save as PDF or TXT');
  throw new UnsupportedFormatError(ext ? `.${ext} files aren’t supported — use EPUB, PDF or TXT` : 'Unknown file type — use EPUB, PDF or TXT');
}

/** Store parsed content and add the book to the library. Returns the new Book. */
export async function saveParsedBook(
  parsed: ParsedBook,
  meta: {
    format: BookFormat;
    sizeBytes: number;
    transient?: boolean;
    shelves?: string[];
    tags?: string[];
    author?: string;
  },
): Promise<Book> {
  if (!parsed.words.length) throw new UnreadableError('No readable text was found');
  const id = newId();
  const title = parsed.title.trim() || 'Untitled';
  const book: Book = {
    id,
    title,
    author: meta.author ?? (parsed.author.trim() || 'Unknown author'),
    format: meta.format,
    sizeBytes: meta.sizeBytes,
    wordCount: parsed.words.length,
    chapters: parsed.chapters.length ? parsed.chapters : [{ title: 'Beginning', startWord: 0 }],
    progressWordIndex: 0,
    lastReadAt: null,
    addedAt: Date.now(),
    finishedAt: null,
    shelves: meta.shelves ?? [],
    tags: meta.tags ?? [],
    description: parsed.description,
    hasCover: false,
    coverHue: hueFromTitle(title),
    bookmarks: [],
    ...(meta.transient ? { transient: true } : {}),
  };

  await saveBookContent({
    bookId: id,
    words: parsed.words,
    paragraphStarts: parsed.paragraphStarts,
    images: parsed.images,
  });
  if (parsed.cover) {
    try {
      await saveCover(id, parsed.cover);
      book.hasCover = true;
    } catch {
      /* a missing cover falls back to the typographic one */
    }
  }
  useAppStore.getState().addBook(book);
  return book;
}

/**
 * Parse and import one file. Progress detail is lower-case, e.g. "extracting text, page 214 of 502".
 * Throws UnsupportedFormatError, UnreadableError or ParseError with a user-facing message.
 */
export async function importFile(
  file: File,
  onProgress: (p: { percent: number; detail: string }) => void,
): Promise<Book> {
  const format = detectFormat(file);
  if (file.size === 0) throw new UnreadableError('This file is empty');
  if (file.size > MAX_IMPORT_BYTES) {
    throw new UnreadableError(`This file is too large (${Math.round(file.size / 1048576)} MB) — the limit is ${MAX_IMPORT_BYTES / 1048576} MB`);
  }
  void requestPersistentStorage();
  const progress: ProgressFn = (p) => onProgress({ percent: Math.min(99, Math.max(0, p.percent)), detail: p.detail });
  let parsed: ParsedBook;
  try {
    if (format === 'epub') parsed = await parseEpub(file, progress);
    else if (format === 'pdf') parsed = await parsePdf(file, progress);
    else parsed = await parseTxt(file, progress);
  } catch (e) {
    if (e instanceof StorageFullError || e instanceof UnreadableError || e instanceof UnsupportedFormatError || e instanceof ParseError) throw e;
    console.error('Import failed', file.name, e);
    throw new ParseError('This file couldn’t be read — it may be damaged');
  }
  if (!parsed.words.length) {
    throw new UnreadableError(format === 'pdf' ? 'This PDF is scanned images with no text layer' : 'No readable text was found in this file');
  }
  onProgress({ percent: 99, detail: 'saving' });
  const book = await saveParsedBook(parsed, { format, sizeBytes: file.size });
  onProgress({ percent: 100, detail: 'ready' });
  return book;
}

/** Title for pasted text with no title: the first few words of the first line */
function titleFromText(text: string): string {
  const firstLine = text.trim().split('\n')[0]?.trim() ?? '';
  const words = firstLine.split(/\s+/).filter(Boolean);
  if (!words.length) return 'Untitled';
  const short = words.slice(0, 6).join(' ').replace(/[.,;:!?]+$/, '');
  return words.length > 6 ? `${short}…` : short;
}

/** Paste tab. Transient books are hidden from the library and purged on next launch. */
export async function createBookFromText(title: string, text: string, opts: { transient: boolean }): Promise<Book> {
  const parsed = parsePastedText(title, text);
  if (!title.trim()) parsed.title = titleFromText(text);
  if (!parsed.words.length) throw new UnreadableError('There’s no text to read');
  return saveParsedBook(parsed, {
    format: 'paste',
    sizeBytes: new Blob([text]).size,
    transient: opts.transient,
    author: 'Pasted text',
  });
}
