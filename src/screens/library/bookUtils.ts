// Pure helpers shared by Home, Library, Collections and the Book details drawer.
import type { Book, BookFormat, Chapter, LibraryFilter } from '../../types';
import { bookPercent, bookStatus, isRecentlyAdded } from '../../store/appStore';
import { formatRelativeDay, MONTHS_SHORT } from '../../lib/format';

export const FORMAT_LABEL: Record<BookFormat, string> = {
  epub: 'EPUB',
  pdf: 'PDF',
  txt: 'TXT',
  paste: 'Pasted',
};

/** Tile status text — desktop "38%" / "Finished" / "Unread", mobile "38%" / "Done" / "New" */
export function statusLabel(b: Book, mobile = false): string {
  const st = bookStatus(b);
  if (st === 'finished') return mobile ? 'Done' : 'Finished';
  if (st === 'unread') return mobile ? 'New' : 'Unread';
  return `${bookPercent(b)}%`;
}

/** "Today" / "Oct 6" when read, otherwise "Added Oct 8" */
export function lastReadLabel(b: Book): string {
  if (b.lastReadAt) return formatRelativeDay(b.lastReadAt);
  const d = new Date(b.addedAt);
  return `Added ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** Index of the chapter containing a word index (or -1 when the book has no chapters) */
export function chapterIndexAt(chapters: Chapter[], wordIndex: number): number {
  let found = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].startWord <= wordIndex) found = i;
    else break;
  }
  return chapters.length && found < 0 ? 0 : found;
}

export function chapterAt(b: Book, wordIndex: number): Chapter | undefined {
  const i = chapterIndexAt(b.chapters, wordIndex);
  return i >= 0 ? b.chapters[i] : undefined;
}

/** Most recently read first, then most recently added */
export function byRecent(a: Book, b: Book): number {
  const ra = a.lastReadAt ?? 0;
  const rb = b.lastReadAt ?? 0;
  if (ra !== rb) return rb - ra;
  return b.addedAt - a.addedAt;
}

export type SortKey = 'recent' | 'title' | 'author' | 'progress' | 'added';

export const SORT_LABEL: Record<SortKey, string> = {
  recent: 'Recent',
  title: 'Title',
  author: 'Author',
  progress: 'Progress',
  added: 'Date added',
};

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function sortBooks(books: Book[], key: SortKey): Book[] {
  const out = [...books];
  switch (key) {
    case 'recent':
      return out.sort((a, b) => (b.lastReadAt ?? b.addedAt) - (a.lastReadAt ?? a.addedAt));
    case 'title':
      return out.sort((a, b) => collator.compare(a.title, b.title));
    case 'author':
      return out.sort((a, b) => collator.compare(a.author || '￿', b.author || '￿') || collator.compare(a.title, b.title));
    case 'progress':
      return out.sort((a, b) => bookPercent(b) - bookPercent(a) || byRecent(a, b));
    case 'added':
      return out.sort((a, b) => b.addedAt - a.addedAt);
  }
}

export function filterBooks(books: Book[], f: LibraryFilter): Book[] {
  const q = f.query.trim().toLowerCase();
  const now = Date.now();
  return books.filter((b) => {
    if (f.status !== 'all' && bookStatus(b) !== f.status) return false;
    if (f.format && b.format !== f.format) return false;
    if (f.shelfId && !b.shelves.includes(f.shelfId)) return false;
    if (f.tag && !b.tags.includes(f.tag)) return false;
    if (f.recent && !isRecentlyAdded(b, now)) return false;
    if (q) {
      const hay = `${b.title}\n${b.author}\n${b.tags.join('\n')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function hasActiveFilters(f: LibraryFilter): boolean {
  return f.status !== 'all' || !!f.format || !!f.shelfId || !!f.tag || f.recent || !!f.query.trim();
}

/** Small deterministic hash of a string */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Spine size for the "shelf of spines" — widths 24–34, heights 110–138 (mobile 22–30 / 80–98) */
export function spineSize(id: string, mobile = false): { w: number; h: number } {
  const h = hashString(id);
  if (mobile) return { w: 22 + (h % 9), h: 80 + ((h >>> 8) % 19) };
  return { w: 24 + (h % 11), h: 110 + ((h >>> 8) % 29) };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}
