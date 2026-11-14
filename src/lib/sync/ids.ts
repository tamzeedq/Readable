const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s: string): boolean => UUID_RE.test(s);

function fnv(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic uuid-shaped id derived from a string (not cryptographic). */
export function hashUuid(input: string): string {
  const hex = [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x9e3779b9]
    .map((seed) => fnv(input, seed).toString(16).padStart(8, '0'))
    .join('');
  const v = '4' + hex.slice(13, 16);
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${v}-${variant}-${hex.slice(20, 32)}`;
}

/** Local ids that are not UUIDs (e.g. the default 'fiction' shelf) map to a stable UUID. */
export const toUuid = (id: string): string => (isUuid(id) ? id : hashUuid(id));

export const bookmarkRowId = (bookId: string, wordIndex: number): string =>
  hashUuid(`bookmark:${bookId}:${wordIndex}`);
