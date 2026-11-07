import type { Book } from '../../types';

/** Score a book against a lowercased query; lower is better, null = no match. */
export function scoreBook(b: Book, q: string): number | null {
  const title = b.title.toLowerCase();
  if (title.startsWith(q)) return 0;
  const idx = title.indexOf(q);
  if (idx > 0 && /[\s\-–—:,.'’(]/.test(title[idx - 1])) return 1; // word start
  if (idx >= 0) return 2;
  if (b.author.toLowerCase().includes(q)) return 3;
  if (b.tags.some((t) => t.toLowerCase().includes(q))) return 4;
  return null;
}

export function searchBooks(books: Book[], query: string, limit = 6): Book[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...books]
      .sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0) || b.addedAt - a.addedAt)
      .slice(0, 5);
  }
  const scored: { b: Book; s: number }[] = [];
  for (const b of books) {
    const s = scoreBook(b, q);
    if (s !== null) scored.push({ b, s });
  }
  scored.sort((x, y) => x.s - y.s || (y.b.lastReadAt ?? 0) - (x.b.lastReadAt ?? 0) || x.b.title.localeCompare(y.b.title));
  return scored.slice(0, limit).map((x) => x.b);
}

/** Split text around the first case-insensitive match of q. */
export function splitMatch(text: string, query: string): [string, string, string] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return null;
  return [text.slice(0, i), text.slice(i, i + q.length), text.slice(i + q.length)];
}
