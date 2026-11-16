// IndexedDB persistence for large per-book data (full text, images, covers).
// Library metadata lives in the zustand store (localStorage); this holds everything heavy.
import { createStore, get, set, del } from 'idb-keyval';
import { useEffect, useState } from 'react';
import type { BookContent } from '../types';

/** Thrown when the browser refuses a write because storage is full. */
export class StorageFullError extends Error {
  constructor(message = 'Your device is out of storage space for Readable. Remove a book or free up space and try again.') {
    super(message);
    this.name = 'StorageFullError';
  }
}

export function isQuotaError(e: unknown): boolean {
  const err = e as { name?: string; code?: number } | null;
  return !!err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014);
}

async function guardedSet(key: string, value: unknown, store: ReturnType<typeof createStore>): Promise<void> {
  try {
    await set(key, value, store);
  } catch (e) {
    if (isQuotaError(e)) throw new StorageFullError();
    console.error('Storage write failed', e);
    // eslint-disable-next-line preserve-caught-error -- cause is already logged above
    throw new Error('Couldn’t save to this device’s storage. Private browsing can cause this.');
  }
}

/** Ask the browser not to evict our data. Safe to call repeatedly; never throws. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) await navigator.storage.persist();
  } catch {
    /* best effort */
  }
}

const contentStore = createStore('readable-content', 'books');
const coverStore = createStore('readable-covers', 'covers');

export async function saveBookContent(content: BookContent): Promise<void> {
  await guardedSet(content.bookId, content, contentStore);
}

export async function loadBookContent(bookId: string): Promise<BookContent | undefined> {
  return get<BookContent>(bookId, contentStore);
}

export async function saveCover(bookId: string, blob: Blob): Promise<void> {
  await guardedSet(bookId, blob, coverStore);
  coverListeners.forEach((fn) => fn(bookId));
}

export async function loadCover(bookId: string): Promise<Blob | undefined> {
  return get<Blob>(bookId, coverStore);
}

export async function deleteCover(bookId: string): Promise<void> {
  await del(bookId, coverStore);
  coverListeners.forEach((fn) => fn(bookId));
}

export async function deleteBookData(bookId: string): Promise<void> {
  await Promise.all([del(bookId, contentStore), del(bookId, coverStore)]);
  coverListeners.forEach((fn) => fn(bookId));
}

const coverListeners = new Set<(bookId: string) => void>();

/** Object URL for a stored cover, or null. Pass hasCover so books without covers skip the lookup. */
export function useCoverUrl(bookId: string | undefined, hasCover: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onChange = (id: string) => {
      if (id === bookId) setVersion((v) => v + 1);
    };
    coverListeners.add(onChange);
    return () => {
      coverListeners.delete(onChange);
    };
  }, [bookId]);

  useEffect(() => {
    if (!bookId || !hasCover) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    loadCover(bookId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookId, hasCover, version]);

  return url;
}
