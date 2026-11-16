// On-device text extraction for EPUB, PDF, TXT and pasted text.
// Produces display tokens (punctuation attached), paragraph starts, chapters and inline images.
import JSZip from 'jszip';
import type { Chapter } from '../types';

// ---------------------------------------------------------------------------
// Public types & errors
// ---------------------------------------------------------------------------

export interface ParsedImage {
  at: number;
  blob: Blob;
  alt: string;
  caption?: string;
}

export interface ParsedBook {
  title: string;
  author: string;
  description?: string;
  words: string[];
  paragraphStarts: number[];
  chapters: Chapter[];
  images: ParsedImage[];
  cover?: Blob;
}

export interface ParseProgress {
  /** 0–100 */
  percent: number;
  /** Lower-case detail, e.g. "extracting text, page 214 of 502" */
  detail: string;
}
export type ProgressFn = (p: ParseProgress) => void;

/** File type we don't handle */
export class UnsupportedFormatError extends Error {
  constructor(message = 'This file type isn’t supported') {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

/** The file is valid but has no extractable text (scanned PDF, DRM, empty) */
export class UnreadableError extends Error {
  constructor(message = 'No readable text was found in this file') {
    super(message);
    this.name = 'UnreadableError';
  }
}

/** The file is damaged or not what its extension says */
export class ParseError extends Error {
  constructor(message = 'This file couldn’t be read — it may be damaged') {
    super(message);
    this.name = 'ParseError';
  }
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/** Soft hyphen, zero-width chars, BOM, word joiner, bidi marks */
const INVISIBLE_RE = /[\u00AD\u200B-\u200D\u2060\uFEFF\u200E\u200F\u202A-\u202E]/g;
/** Exotic whitespace (nbsp, thin/hair/figure spaces, ideographic space, line/para separators, tabs) */
const ODD_SPACE_RE = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\t\f\v]/g;
const HAS_WORD_CHAR_RE = /[\p{L}\p{N}]/u;
/** Tokens made only of these attach to the previous word ("word ." → "word.") */
const CLOSING_ONLY_RE = /^[.,;:!?)\]}\u00BB\u201D\u2019"'\u2026%]+$/;
/** Tokens made only of these attach to the next word ("“ Well" → "“Well") */
const OPENING_ONLY_RE = /^[([{\u00AB\u201C\u2018"']+$/;

export function normalizeText(text: string): string {
  return text.replace(INVISIBLE_RE, '').replace(ODD_SPACE_RE, ' ').replace(/\r\n?/g, '\n');
}

/** Split text into display tokens with punctuation kept on the word. */
export function tokenize(text: string): string[] {
  const raw = normalizeText(text).split(/\s+/);
  const out: string[] = [];
  let carry = '';
  for (const tok of raw) {
    if (!tok) continue;
    if (!HAS_WORD_CHAR_RE.test(tok)) {
      if (OPENING_ONLY_RE.test(tok)) {
        carry += tok;
        continue;
      }
      if (CLOSING_ONLY_RE.test(tok) && out.length) {
        out[out.length - 1] += tok;
        continue;
      }
    }
    out.push(carry + tok);
    carry = '';
  }
  if (carry) {
    if (out.length) out[out.length - 1] += carry;
    else out.push(carry);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Builder shared by all formats
// ---------------------------------------------------------------------------

class TextBuilder {
  words: string[] = [];
  paragraphStarts: number[] = [];
  chapters: Chapter[] = [];
  images: ParsedImage[] = [];

  /** Adds a paragraph; returns the number of tokens added */
  addParagraph(text: string): number {
    if (!HAS_WORD_CHAR_RE.test(text)) return 0; // separators like "* * *"
    const tokens = tokenize(text);
    if (!tokens.length) return 0;
    const start = this.words.length;
    if (this.paragraphStarts[this.paragraphStarts.length - 1] !== start) this.paragraphStarts.push(start);
    for (const t of tokens) this.words.push(t);
    return tokens.length;
  }

  markChapter(title: string, at = this.words.length) {
    const clean = cleanInline(title);
    if (!clean) return;
    const last = this.chapters[this.chapters.length - 1];
    if (last && last.startWord === at) return; // keep the first title at a position
    this.chapters.push({ title: clean, startWord: at });
  }

  finish(): Pick<ParsedBook, 'words' | 'paragraphStarts' | 'chapters' | 'images'> {
    const paragraphStarts = this.paragraphStarts.filter((p) => p < this.words.length);
    if (paragraphStarts[0] !== 0) paragraphStarts.unshift(0);
    const images = this.images
      .map((im) => ({ ...im, at: Math.min(im.at, Math.max(0, this.words.length - 1)) }))
      .sort((a, b) => a.at - b.at);
    return {
      words: this.words,
      paragraphStarts,
      chapters: finalizeChapters(this.chapters, this.words.length),
      images,
    };
  }
}

/** Sort, dedupe, keep within range, and make sure the list is non-empty and covers word 0. */
function finalizeChapters(chapters: Chapter[], wordCount: number): Chapter[] {
  const sorted = chapters
    .filter((c) => c.startWord >= 0 && (c.startWord < wordCount || wordCount === 0))
    .sort((a, b) => a.startWord - b.startWord);
  const out: Chapter[] = [];
  for (const c of sorted) {
    if (out.length && out[out.length - 1].startWord === c.startWord) continue;
    out.push({ title: c.title.slice(0, 160), startWord: c.startWord });
  }
  if (!out.length) return [{ title: 'Beginning', startWord: 0 }];
  if (out[0].startWord > 0) {
    // A short title page before the first chapter folds into it; longer front matter gets its own entry.
    if (out[0].startWord < 300) out[0] = { ...out[0], startWord: 0 };
    else out.unshift({ title: 'Beginning', startWord: 0 });
  }
  return out;
}

function cleanInline(s: string): string {
  return normalizeText(s).replace(/\s+/g, ' ').trim();
}

function countTokens(s: string): number {
  return tokenize(s).length;
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Titles from file names
// ---------------------------------------------------------------------------

export function titleFromFilename(name: string): string {
  const base = name.replace(/\.[a-z0-9]{1,8}$/i, '').replace(/[_]+/g, ' ').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return 'Untitled';
  if (base === base.toLowerCase()) {
    return base
      .replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase())
      .replace(/\s(Of|The|And|A|An|In|On|To|For|At|By|Or)(?=\s)/g, (m) => m.toLowerCase());
  }
  return base;
}

// ---------------------------------------------------------------------------
// Plain text (TXT files and pasted text)
// ---------------------------------------------------------------------------

const NUMBER_WORDS =
  'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|the\\s+\\w+';
const CHAPTER_HEADING_RE = new RegExp(
  `^(chapter|book|part|volume|vol\\.|act|canto|letter|section|stave)\\s+([0-9]+|[ivxlcdm]+|${NUMBER_WORDS})\\b[.:]?(\\s*[-—–:.]?\\s*.{0,70})?$`,
  'i',
);
const ROMAN_ALONE_RE = /^[IVXLCDM]{1,7}\.?$/;
const NAMED_SECTION_RE = /^(prologue|epilogue|preface|introduction|foreword|afterword|prelude|finale|appendix|conclusion)\.?$/i;

function isChapterHeading(line: string): boolean {
  const l = line.trim();
  if (!l || l.length > 90) return false;
  return CHAPTER_HEADING_RE.test(l) || ROMAN_ALONE_RE.test(l) || NAMED_SECTION_RE.test(l);
}

function stripGutenberg(text: string): { body: string; title?: string; author?: string } {
  const start = /^.*\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG E-?BOOK.*$/im.exec(text);
  if (!start) return { body: text };
  const header = text.slice(0, start.index);
  let body = text.slice(start.index + start[0].length);
  const end = /^.*\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG E-?BOOK.*$/im.exec(body);
  if (end) body = body.slice(0, end.index);
  const title = /^Title:\s*(.+)$/im.exec(header)?.[1]?.trim();
  const author = /^Author:\s*(.+)$/im.exec(header)?.[1]?.trim();
  return { body, title, author };
}

/** Join wrapped lines of a block, undoing hyphenated line breaks */
function joinLines(lines: string[]): string {
  let out = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!out) out = line;
    else if (out.endsWith('\u00AD')) out = out.slice(0, -1) + line;
    else if (/\p{L}-$/u.test(out) && /^\p{Ll}/u.test(line)) out = out.slice(0, -1) + line;
    else out += ' ' + line;
  }
  return out;
}

export interface TextParseOptions {
  /** File name, used for the fallback title */
  filename?: string;
  /** Explicit title (pasted text) */
  title?: string;
}

/** Parse plain text into a book. Used for TXT/MD files and pasted text. */
export function parsePlainText(input: string, opts: TextParseOptions = {}): ParsedBook {
  const text = normalizeText(input);
  const g = stripGutenberg(text);
  const body = g.body.replace(/^\n+/, '');

  // Markdown-ish cleanup: heading markers, emphasis bullets are harmless; strip "#"s so headings read cleanly
  const isMarkdown = /\.(md|markdown)$/i.test(opts.filename ?? '');

  const hasBlankLines = /\n[ \t]*\n/.test(body);
  const blocks: string[][] = hasBlankLines
    ? body.split(/\n[ \t]*\n+/).map((b) => b.split('\n'))
    : body.split('\n').map((l) => [l]);

  // Title / author heuristics from the first lines
  let title = opts.title?.trim() || g.title;
  let author = g.author;
  if (!title && !opts.title && blocks.length > 1) {
    const first = blocks[0].map((l) => l.trim()).filter(Boolean);
    const firstLine = (first[0] ?? '').replace(/^#+\s*/, '');
    const looksLikeTitle =
      firstLine.length > 0 &&
      firstLine.length <= 80 &&
      firstLine.split(/\s+/).length <= 12 &&
      !/[.,;:]$/.test(firstLine) &&
      !isChapterHeading(firstLine) &&
      first.length <= 3;
    if (looksLikeTitle) {
      title = firstLine;
      const byLine = first.slice(1).find((l) => /^by\s+\S/i.test(l)) ??
        (blocks[1] && blocks[1].length === 1 && /^by\s+\S/i.test(blocks[1][0].trim()) ? blocks[1][0].trim() : undefined);
      if (byLine) author = byLine.replace(/^by\s+/i, '').trim();
    }
  }
  if (!title) title = opts.filename ? titleFromFilename(opts.filename) : 'Untitled';

  const b = new TextBuilder();
  for (const block of blocks) {
    const lines = block.map((l) => (isMarkdown ? l.replace(/^\s{0,3}#{1,6}\s+/, '') : l));
    const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
    if (!nonEmpty.length) continue;

    const mdHeading = isMarkdown && block.length === 1 && /^\s{0,3}#{1,2}\s+\S/.test(block[0]);
    if (isChapterHeading(nonEmpty[0]) || mdHeading) {
      // "CHAPTER I.\nLoomings." in one block → "Chapter I. Loomings."
      const extra = nonEmpty.length > 1 && nonEmpty.length <= 2 && nonEmpty[1].length < 70 ? ' ' + nonEmpty[1] : '';
      b.markChapter(prettyHeading(nonEmpty[0] + extra));
      if (extra) {
        b.addParagraph(nonEmpty[0] + extra);
        continue;
      }
    }
    b.addParagraph(joinLines(lines));
  }

  const result = b.finish();
  result.chapters = dropTableOfContentsRuns(result.chapters, result.words.length);
  return { title: cleanInline(title).slice(0, 200) || 'Untitled', author: author ? cleanInline(author) : '', ...result };
}

/** Gutenberg tables of contents list every heading back to back; drop entries with almost no text after them. */
function dropTableOfContentsRuns(chapters: Chapter[], wordCount: number): Chapter[] {
  if (chapters.length < 3) return chapters;
  const kept = chapters.filter((c, i) => {
    const next = chapters[i + 1]?.startWord ?? wordCount;
    return next - c.startWord >= 30 || i === chapters.length - 1;
  });
  return finalizeChapters(kept, wordCount);
}

/** "CHAPTER IV. THE FLIGHT" → "Chapter IV. The Flight" (leave mixed-case headings alone) */
function prettyHeading(s: string): string {
  const t = cleanInline(s);
  if (t !== t.toUpperCase() || !/\p{L}/u.test(t)) return t;
  return t
    .toLowerCase()
    .replace(/(^|[\s"“(])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase())
    .replace(
      /^((?:chapter|book|part|volume|act|canto|letter|section|stave)\s+)?([ivxlcdm]{1,7})\b/i,
      (m, kw: string | undefined, num: string) =>
        kw || /^[ivxlcdm]+\.?$/i.test(t) ? (kw ?? '') + num.toUpperCase() : m,
    );
}

/** Decode bytes as UTF-8, falling back to Windows-1252 when the result is mostly garbage. */
export function decodeText(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  const bad = (utf8.match(/�/g) ?? []).length;
  if (bad > 8 || (bad > 0 && bad / Math.max(1, utf8.length) > 0.001)) {
    try {
      return new TextDecoder('windows-1252').decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

export async function parseTxt(file: File, onProgress?: ProgressFn): Promise<ParsedBook> {
  onProgress?.({ percent: 10, detail: 'reading text' });
  const buf = await file.arrayBuffer();
  const text = decodeText(buf);
  onProgress?.({ percent: 50, detail: 'finding chapters' });
  await yieldToUi();
  const parsed = parsePlainText(text, { filename: file.name });
  onProgress?.({ percent: 100, detail: 'done' });
  return parsed;
}

/** Pasted text: same rules as TXT, with the title supplied by the user */
export function parsePastedText(title: string, text: string): ParsedBook {
  return parsePlainText(text, { title: title.trim() || undefined });
}

/** Build a book from known sections (sample books). Each section becomes a chapter. */
export function parseSections(
  meta: { title: string; author: string; description?: string },
  sections: { title: string; paragraphs: string[] }[],
): ParsedBook {
  const b = new TextBuilder();
  for (const s of sections) {
    b.markChapter(s.title);
    b.addParagraph(s.title);
    for (const p of s.paragraphs) b.addParagraph(p);
  }
  return { ...meta, ...b.finish() };
}

// ---------------------------------------------------------------------------
// EPUB
// ---------------------------------------------------------------------------

interface ManifestItem {
  id: string;
  path: string;
  mediaType: string;
  properties: string;
}

function parseXml(text: string, type: DOMParserSupportedType = 'application/xml'): Document {
  const doc = new DOMParser().parseFromString(text, type);
  if (doc.getElementsByTagName('parsererror').length && type !== 'text/html') {
    return new DOMParser().parseFromString(text, 'text/html');
  }
  return doc;
}

/** Elements by local name, ignoring namespaces/prefixes */
function byLocal(root: Document | Element, name: string): Element[] {
  const ns = Array.from(root.getElementsByTagNameNS('*', name));
  if (ns.length) return ns;
  return Array.from(root.getElementsByTagName(name));
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i + 1);
}

function resolvePath(baseDir: string, href: string): string {
  let h = href.split('#')[0];
  try {
    h = decodeURIComponent(h);
  } catch {
    /* keep raw */
  }
  const parts = (h.startsWith('/') ? h.slice(1) : baseDir + h).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

function zipFile(zip: JSZip, path: string): JSZip.JSZipObject | null {
  const direct = zip.file(path);
  if (direct) return direct;
  const lower = path.toLowerCase();
  const found = Object.keys(zip.files).find((k) => k.toLowerCase() === lower);
  return found ? zip.file(found) : null;
}

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
};

function mimeFor(path: string, declared?: string): string {
  if (declared && declared.startsWith('image/')) return declared;
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_MIME[ext] ?? 'application/octet-stream';
}

const SKIP_TAGS = new Set([
  'script', 'style', 'head', 'title', 'nav', 'noscript', 'template', 'math', 'iframe', 'object', 'audio', 'video', 'button', 'input', 'select', 'textarea',
]);
const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'dl', 'dt', 'dd', 'blockquote', 'section', 'article', 'header', 'footer',
  'aside', 'figure', 'figcaption', 'pre', 'table', 'tr', 'td', 'th', 'caption', 'hr', 'main', 'body', 'center', 'address', 'hgroup', 'details', 'summary',
]);
/** epub:type / ARIA role values for notes, note markers and print page markers */
const NOTE_TYPE_RE = /\b(footnotes?|endnotes?|rearnotes?|notes?|noteref|pagebreak|doc-footnote|doc-endnotes?|doc-footnotes|doc-noteref|doc-pagebreak|doc-backlink)\b/;
/** Superscript content that is just a note marker: 12, [3], *, † */
const NOTE_MARK_RE = /^[[(]?(\d{1,3}|[*\u2020\u2021\u00A7]+)[\])]?$/;
const NOTE_BODY_TAGS = new Set(['li', 'aside', 'div', 'p', 'dd', 'section', 'blockquote']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

interface PendingImage {
  at: number;
  path: string;
  alt: string;
  caption?: string;
}

interface DocWalkResult {
  heading?: string;
}

/** Walk one XHTML document, appending paragraphs to the builder. */
function walkDocument(
  doc: Document,
  docPath: string,
  b: TextBuilder,
  anchors: Map<string, number>,
  images: PendingImage[],
  noteTargets: ReadonlySet<string> = new Set(),
): DocWalkResult {
  const baseDir = dirOf(docPath);
  const body = doc.body ?? doc.getElementsByTagName('body')[0] ?? doc.documentElement;
  let buffer = '';
  let heading: string | undefined;

  const flush = () => {
    if (buffer.trim()) b.addParagraph(buffer);
    buffer = '';
  };

  const captionFor = (el: Element): string | undefined => {
    let p: Element | null = el.parentElement;
    for (let depth = 0; p && depth < 4; depth++, p = p.parentElement) {
      const local = p.localName.toLowerCase();
      if (local === 'figure' || (local === 'div' && /figure|illus|image|img|picture/i.test(p.getAttribute('class') ?? ''))) {
        const cap = byLocal(p, 'figcaption')[0] ?? Array.from(p.children).find((c) => /caption/i.test(c.getAttribute('class') ?? ''));
        const txt = cap ? cleanInline(cap.textContent ?? '') : '';
        return txt || undefined;
      }
    }
    return undefined;
  };

  const visit = (node: Node) => {
    if (node.nodeType === 3 /* text */) {
      buffer += node.nodeValue ?? '';
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.localName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;
    const epubType = `${el.getAttribute('epub:type') ?? ''} ${el.getAttribute('role') ?? ''}`;
    if (NOTE_TYPE_RE.test(epubType)) return;
    if (tag === 'aside' && !/\b(sidebar|pullquote|tip|warning|example|doc-tip|doc-pullquote)\b/.test(epubType)) return;
    const elId = el.getAttribute('id');
    if (elId && noteTargets.has(elId) && NOTE_BODY_TAGS.has(tag)) return;
    if (
      el.hasAttribute('hidden') ||
      el.getAttribute('aria-hidden') === 'true' ||
      /display\s*:\s*none|visibility\s*:\s*hidden/i.test(el.getAttribute('style') ?? '')
    ) {
      return;
    }
    if (tag === 'sup' || tag === 'sub') {
      const txt = (el.textContent ?? '').trim();
      // Footnote call-outs: a superscript link, or a bare number glued to the end of a word
      if (el.getElementsByTagName('a').length && txt.length <= 6) return;
      if (NOTE_MARK_RE.test(txt) && /[\p{L}.,;:!?)”’"'*]$/u.test(buffer.replace(INVISIBLE_RE, ''))) return;
    }

    if (tag === 'img' || tag === 'image') {
      const href = el.getAttribute('src') ?? el.getAttribute('xlink:href') ?? el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? el.getAttribute('href');
      if (href && !/^data:|^https?:/i.test(href)) {
        flush();
        images.push({ at: b.words.length, path: resolvePath(baseDir, href), alt: cleanInline(el.getAttribute('alt') ?? ''), caption: captionFor(el) });
      }
      return;
    }
    if (tag === 'br') {
      buffer += ' ';
      return;
    }

    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) flush();
    const id = elId;
    if (id) {
      const key = `${docPath}#${id}`;
      if (!anchors.has(key)) anchors.set(key, b.words.length + (buffer.trim() ? countTokens(buffer) : 0));
    }
    if (HEADING_TAGS.has(tag) && !heading && tag <= 'h3') {
      const t = cleanInline(el.textContent ?? '');
      if (t) heading = t;
    }
    for (let c = el.firstChild; c; c = c.nextSibling) visit(c);
    if (isBlock) flush();
  };

  if (body) visit(body);
  flush();
  return { heading };
}

interface TocEntry {
  title: string;
  path: string;
  fragment?: string;
}

function tocFromNav(doc: Document, navPath: string): TocEntry[] {
  const navs = byLocal(doc, 'nav');
  const toc = navs.find((n) => /\btoc\b/.test(n.getAttribute('epub:type') ?? n.getAttribute('type') ?? n.getAttribute('role') ?? '')) ?? navs[0];
  if (!toc) return [];
  const baseDir = dirOf(navPath);
  return byLocal(toc, 'a')
    .map((a) => {
      const href = a.getAttribute('href') ?? '';
      return { title: cleanInline(a.textContent ?? ''), path: resolvePath(baseDir, href), fragment: href.split('#')[1] };
    })
    .filter((e) => e.title && e.path);
}

function tocFromNcx(doc: Document, ncxPath: string): TocEntry[] {
  const baseDir = dirOf(ncxPath);
  const navMap = byLocal(doc, 'navMap')[0];
  if (!navMap) return [];
  return byLocal(navMap, 'navPoint')
    .map((np) => {
      const label = Array.from(np.children).find((c) => c.localName === 'navLabel');
      const content = Array.from(np.children).find((c) => c.localName === 'content');
      const src = content?.getAttribute('src') ?? '';
      return { title: cleanInline(label?.textContent ?? ''), path: resolvePath(baseDir, src), fragment: src.split('#')[1] };
    })
    .filter((e) => e.title && e.path);
}

async function loadText(zip: JSZip, path: string): Promise<string | null> {
  const f = zipFile(zip, path);
  return f ? f.async('string') : null;
}

export async function parseEpub(file: File, onProgress?: ProgressFn): Promise<ParsedBook> {
  onProgress?.({ percent: 2, detail: 'opening book' });
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new ParseError('This EPUB couldn’t be opened — it may be damaged');
  }

  const containerXml = await loadText(zip, 'META-INF/container.xml');
  let opfPath = containerXml ? byLocal(parseXml(containerXml), 'rootfile')[0]?.getAttribute('full-path') ?? '' : '';
  if (!opfPath || !zipFile(zip, opfPath)) {
    opfPath = Object.keys(zip.files).find((k) => k.toLowerCase().endsWith('.opf')) ?? '';
  }
  const opfText = opfPath ? await loadText(zip, opfPath) : null;
  if (!opfText) throw new ParseError('This EPUB is missing its table of contents file');
  const opf = parseXml(opfText);
  const opfDir = dirOf(opfPath);

  // DRM: encrypted content documents can't be read
  const encryption = await loadText(zip, 'META-INF/encryption.xml');
  if (encryption && /EncryptedData/.test(encryption) && !/idpf\.org\/2008\/embedding|ns\.adobe\.com\/pdf\/enc#RC/i.test(encryption.replace(/<CipherReference[^>]*URI="[^"]*\.(otf|ttf|woff2?)"/gi, ''))) {
    const refs = Array.from(encryption.matchAll(/URI="([^"]+)"/g)).map((m) => m[1]);
    if (refs.some((r) => /\.x?html?$/i.test(r))) throw new UnreadableError('This EPUB is protected with DRM and can’t be read');
  }

  // Metadata
  const metadata = byLocal(opf, 'metadata')[0] ?? opf.documentElement;
  const metaText = (name: string) => byLocal(metadata, name).map((e) => cleanInline(e.textContent ?? '')).filter(Boolean);
  const title = metaText('title')[0] || titleFromFilename(file.name);
  const creators = byLocal(metadata, 'creator');
  const authors = creators
    .filter((c) => {
      const role = c.getAttribute('opf:role') ?? c.getAttributeNS('http://www.idpf.org/2007/opf', 'role');
      return !role || role === 'aut';
    })
    .map((c) => cleanInline(c.textContent ?? ''))
    .filter(Boolean);
  const author = (authors.length ? authors : creators.map((c) => cleanInline(c.textContent ?? '')).filter(Boolean)).slice(0, 3).join(', ');
  const rawDescription = metaText('description')[0];
  const description = rawDescription
    ? cleanInline(new DOMParser().parseFromString(rawDescription, 'text/html').body.textContent ?? rawDescription) || undefined
    : undefined;

  // Manifest & spine
  const manifest = new Map<string, ManifestItem>();
  for (const item of byLocal(opf, 'item')) {
    const id = item.getAttribute('id') ?? '';
    const href = item.getAttribute('href') ?? '';
    if (!id || !href) continue;
    manifest.set(id, { id, path: resolvePath(opfDir, href), mediaType: item.getAttribute('media-type') ?? '', properties: item.getAttribute('properties') ?? '' });
  }
  const spineEl = byLocal(opf, 'spine')[0];
  const spine = byLocal(opf, 'itemref')
    .map((ir) => manifest.get(ir.getAttribute('idref') ?? ''))
    .filter((m): m is ManifestItem => !!m && /html|xml/i.test(m.mediaType || 'xhtml'));
  if (!spine.length) throw new ParseError('This EPUB has no readable chapters');

  // Cover
  const items = Array.from(manifest.values());
  let coverItem = items.find((m) => /\bcover-image\b/.test(m.properties));
  if (!coverItem) {
    const coverMeta = byLocal(metadata, 'meta').find((m) => m.getAttribute('name') === 'cover');
    const cid = coverMeta?.getAttribute('content');
    if (cid) coverItem = manifest.get(cid) ?? items.find((m) => m.path.endsWith(cid));
  }
  let coverPath = coverItem && coverItem.mediaType.startsWith('image/') ? coverItem.path : undefined;
  if (!coverPath) {
    const guideRef = byLocal(opf, 'reference').find((r) => /cover/i.test(r.getAttribute('type') ?? ''));
    const guideHref = guideRef?.getAttribute('href');
    if (guideHref) {
      const pagePath = resolvePath(opfDir, guideHref);
      if (/\.(jpe?g|png|gif|webp)$/i.test(pagePath)) coverPath = pagePath;
      else {
        const pageText = await loadText(zip, pagePath);
        if (pageText) {
          const pageDoc = parseXml(pageText, 'application/xhtml+xml');
          const img = byLocal(pageDoc, 'img')[0] ?? byLocal(pageDoc, 'image')[0];
          const src = img?.getAttribute('src') ?? img?.getAttribute('xlink:href') ?? img?.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
          if (src) coverPath = resolvePath(dirOf(pagePath), src);
        }
      }
    }
  }
  if (!coverPath) {
    coverPath = items.find((m) => m.mediaType.startsWith('image/') && /cover/i.test(m.id + ' ' + m.path))?.path;
  }

  // Table of contents
  let toc: TocEntry[] = [];
  const navItem = items.find((m) => /\bnav\b/.test(m.properties));
  if (navItem) {
    const navText = await loadText(zip, navItem.path);
    if (navText) toc = tocFromNav(parseXml(navText, 'application/xhtml+xml'), navItem.path);
  }
  if (!toc.length) {
    const ncxId = spineEl?.getAttribute('toc');
    const ncxItem = (ncxId && manifest.get(ncxId)) || items.find((m) => m.mediaType === 'application/x-dtbncx+xml' || /\.ncx$/i.test(m.path));
    if (ncxItem) {
      const ncxText = await loadText(zip, ncxItem.path);
      if (ncxText) toc = tocFromNcx(parseXml(ncxText), ncxItem.path);
    }
  }

  // Walk spine documents
  const b = new TextBuilder();
  const anchors = new Map<string, number>();
  const docStarts = new Map<string, number>();
  const docHeadings: { path: string; start: number; end: number; heading?: string }[] = [];
  const pendingImages: PendingImage[] = [];
  const seen = new Set<string>();

  // Ids that note call-outs point at (footnote/endnote bodies), found with a cheap scan before parsing
  const noteTargets = new Set<string>();
  for (const item of spine) {
    const raw = await loadText(zip, item.path);
    if (!raw) continue;
    for (const m of raw.matchAll(/<a\b[^>]*>/gi)) {
      const tagText = m[0];
      const href = /href\s*=\s*["']([^"']*)["']/i.exec(tagText)?.[1];
      const frag = href?.split('#')[1];
      if (!frag) continue;
      if (/noteref/i.test(tagText)) noteTargets.add(frag);
    }
    for (const m of raw.matchAll(/<sup\b[^>]*>\s*<a\b[^>]*href\s*=\s*["'][^"']*#([^"']+)["']/gi)) noteTargets.add(m[1]);
  }

  for (let i = 0; i < spine.length; i++) {
    const item = spine[i];
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    onProgress?.({ percent: 5 + Math.round((i / spine.length) * 85), detail: `extracting text, section ${i + 1} of ${spine.length}` });
    const text = await loadText(zip, item.path);
    if (!text) continue;
    const doc = parseXml(text, /html/i.test(item.mediaType) && !/xhtml/i.test(item.mediaType) ? 'text/html' : 'application/xhtml+xml');
    const start = b.words.length;
    docStarts.set(item.path, start);
    const { heading } = walkDocument(doc, item.path, b, anchors, pendingImages, noteTargets);
    docHeadings.push({ path: item.path, start, end: b.words.length, heading });
    if (i % 4 === 3) await yieldToUi();
  }

  // Chapters from the TOC, else one per spine document
  const seenAt = new Set<number>();
  for (const entry of toc) {
    if (/^(table of )?contents$|^cover$|^(end|foot)?notes$/i.test(entry.title)) continue;
    const at = (entry.fragment ? anchors.get(`${entry.path}#${entry.fragment}`) : undefined) ?? docStarts.get(entry.path);
    if (at === undefined || at >= b.words.length || seenAt.has(at)) continue;
    seenAt.add(at);
    b.chapters.push({ title: entry.title, startWord: at });
  }
  if (b.chapters.length < 1) {
    let n = 0;
    for (const d of docHeadings) {
      if (d.end - d.start < 20) continue;
      n++;
      b.chapters.push({ title: d.heading && d.heading.length <= 100 ? d.heading : `Chapter ${n}`, startWord: d.start });
    }
  }

  // Images
  onProgress?.({ percent: 92, detail: 'loading images' });
  const blobCache = new Map<string, Blob | null>();
  const pathToMime = new Map(items.map((m) => [m.path, m.mediaType]));
  const loadBlob = async (path: string): Promise<Blob | null> => {
    if (blobCache.has(path)) return blobCache.get(path)!;
    const f = zipFile(zip, path);
    let blob: Blob | null = null;
    if (f) {
      const data = await f.async('uint8array');
      blob = new Blob([data as BlobPart], { type: mimeFor(path, pathToMime.get(path)) });
    }
    blobCache.set(path, blob);
    return blob;
  };

  let cover: Blob | undefined;
  if (coverPath) cover = (await loadBlob(coverPath)) ?? undefined;

  for (const im of pendingImages) {
    if (im.path === coverPath) continue;
    // Images before any text on the first page are usually the cover/title art
    if (im.at === 0 && cover && pendingImages.indexOf(im) === 0 && /cover/i.test(im.path)) continue;
    const blob = await loadBlob(im.path);
    if (!blob || blob.size < 2048) continue; // decorative ornaments, spacers
    b.images.push({ at: im.at, blob, alt: im.alt, caption: im.caption });
  }

  // Covers from images on a cover page we didn't otherwise catch
  if (!cover) {
    const firstImg = pendingImages[0];
    if (firstImg && firstImg.at === 0) {
      const blob = await loadBlob(firstImg.path);
      if (blob && blob.size > 8000) {
        cover = blob;
        b.images = b.images.filter((im) => im.blob !== blob);
      }
    }
  }

  onProgress?.({ percent: 100, detail: 'done' });
  return { title, author, description, cover, ...b.finish() };
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

type PdfjsModule = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** Lazy-load pdf.js so it isn't in the startup bundle */
function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
      return mod;
    });
  }
  return pdfjsPromise;
}

export interface PdfLine {
  text: string;
  x: number;
  y: number;
  right: number;
  size: number;
}

export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

function linesFromItems(items: PdfTextItem[]): PdfLine[] {
  const lines: PdfLine[] = [];
  let cur: PdfLine | null = null;
  let prevEnd = 0;
  let forceBreak = false;
  for (const it of items) {
    const str = it.str ?? '';
    const x = it.transform[4];
    const y = it.transform[5];
    const size = Math.abs(it.transform[3]) || Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
    if (!str) {
      if (it.hasEOL) forceBreak = true;
      continue;
    }
    const sameLine = cur && !forceBreak && Math.abs(y - cur.y) < Math.max(cur.size, size) * 0.45;
    // Footnote call-outs: a small raised number/symbol glued to the end of a word
    if (sameLine && cur && size < cur.size * 0.8 && NOTE_MARK_RE.test(str.trim()) && /[\p{L}.,;:!?)”’"'*]$/u.test(cur.text)) {
      prevEnd = x + it.width;
      forceBreak = !!it.hasEOL;
      continue;
    }
    if (!sameLine) {
      if (cur && cur.text.trim()) lines.push(cur);
      cur = { text: str, x, y, right: x + it.width, size };
    } else if (cur) {
      const gap = x - prevEnd;
      const needsSpace = gap > size * 0.12 && !/\s$/.test(cur.text) && !/^\s/.test(str);
      cur.text += (needsSpace ? ' ' : '') + str;
      cur.right = Math.max(cur.right, x + it.width);
      cur.size = Math.max(cur.size, size);
    }
    prevEnd = x + it.width;
    forceBreak = !!it.hasEOL;
  }
  if (cur && cur.text.trim()) lines.push(cur);
  return lines;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const PDF_PAGE_NUMBER_RE = /^(page\s+)?[-–—\s]*(\d{1,4}|[ivxlcdm]{1,7})[-–—\s]*(of\s+\d+)?$/i;

function furnitureKey(t: string): string {
  return t.trim().toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ');
}

/** Keys of lines that repeat at the top/bottom of many pages (running headers, footers, page numbers). */
export function findRunningFurniture(pages: PdfLine[][]): Set<string> {
  const keys = new Set<string>();
  if (pages.length < 3) return keys;
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const edge = new Set<string>();
    for (const l of [...lines.slice(0, 2), ...lines.slice(-2)]) {
      const k = furnitureKey(l.text);
      if (k) edge.add(k);
    }
    for (const k of edge) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const min = Math.max(3, Math.ceil(pages.length * 0.4));
  for (const [k, n] of counts) if (n >= min) keys.add(k);
  return keys;
}

/** Remove running heads/feet, page numbers and footnote blocks (small type at the page bottom) from one page. */
function cleanPageLines(lines: PdfLine[], furniture: ReadonlySet<string>): PdfLine[] {
  let body = lines.filter((l, i) => {
    const edge = i < 2 || i >= lines.length - 2;
    if (!edge) return true;
    if (furniture.has(furnitureKey(l.text))) return false;
    const atEnd = i === 0 || i === lines.length - 1;
    return !(atEnd && PDF_PAGE_NUMBER_RE.test(l.text.trim()));
  });
  const bodySize = median(body.map((l) => l.size));
  let cut = body.length;
  while (cut > 1 && body[cut - 1].size < bodySize * 0.88) cut--;
  if (cut < body.length && body.length - cut <= Math.ceil(body.length * 0.4)) body = body.slice(0, cut);
  return body;
}

/** Group a page's lines into paragraphs. */
function paragraphsFromLines(body: PdfLine[]): string[] {
  if (!body.length) return [];
  const gaps: number[] = [];
  for (let i = 1; i < body.length; i++) {
    const g = body[i - 1].y - body[i].y;
    if (g > 0) gaps.push(g);
  }
  const lineGap = median(gaps) || body[0].size * 1.2;
  const minX = Math.min(...body.map((l) => l.x));
  const maxRight = Math.max(...body.map((l) => l.right));
  const width = Math.max(1, maxRight - minX);

  const paras: string[] = [];
  let cur: string[] = [];
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    if (i > 0 && cur.length) {
      const prev = body[i - 1];
      const gap = prev.y - line.y;
      const bigGap = gap > lineGap * 1.45 || gap < -lineGap; // new column also breaks
      const indented = line.x - minX > line.size * 0.9 && line.x - prev.x > line.size * 0.9;
      const prevShort = prev.right < minX + width * 0.75 && /[.!?:"”’)]$/.test(prev.text.trim());
      const sizeChange = Math.abs(line.size - prev.size) > Math.max(1.5, prev.size * 0.2);
      if (bigGap || indented || prevShort || sizeChange) {
        paras.push(joinLines(cur));
        cur = [];
      }
    }
    cur.push(line.text);
  }
  if (cur.length) paras.push(joinLines(cur));
  return paras.filter((p) => p.trim());
}

/** Turn per-page lines into paragraphs in the builder; returns the first word index of each page. */
export function assemblePdfPages(pageLines: PdfLine[][], b: TextBuilder): number[] {
  const furniture = findRunningFurniture(pageLines);
  const pageStart: number[] = [];
  let carry = ''; // paragraph that may continue on the next page
  for (let p = 0; p < pageLines.length; p++) {
    const paras = paragraphsFromLines(cleanPageLines(pageLines[p], furniture));
    pageStart[p] = b.words.length + (carry ? countTokens(carry) : 0);
    for (let i = 0; i < paras.length; i++) {
      let para = paras[i];
      if (i === 0 && carry) {
        // Continue a sentence broken across the page boundary
        if (/^\p{Ll}/u.test(para) || /\p{L}-$/u.test(carry)) {
          para = /\p{L}-$/u.test(carry) && /^\p{Ll}/u.test(para) ? carry.slice(0, -1) + para : carry + ' ' + para;
        } else {
          b.addParagraph(carry);
        }
        carry = '';
        pageStart[p] = b.words.length;
      }
      if (i === paras.length - 1 && !/[.!?:"”’)]$/.test(para.trim())) carry = para;
      else b.addParagraph(para);
    }
  }
  if (carry) b.addParagraph(carry);
  return pageStart;
}

/** Test seam: assemble raw pdf.js text items (one array per page) into a book body. */
export function parsePdfTextItems(pages: PdfTextItem[][]): Pick<ParsedBook, 'words' | 'paragraphStarts' | 'chapters'> {
  const b = new TextBuilder();
  assemblePdfPages(pages.map(linesFromItems), b);
  const { words, paragraphStarts, chapters } = b.finish();
  return { words, paragraphStarts, chapters };
}

function looksLikeJunkTitle(t: string | undefined): boolean {
  if (!t) return true;
  const s = t.trim();
  return !s || s.length < 2 || /^(untitled|microsoft word|document\d*)\b/i.test(s) || /\.(docx?|pdf|txt|rtf|indd|tex|odt)$/i.test(s) || /^[\w-]+\.\w+$/.test(s);
}

export async function parsePdf(file: File, onProgress?: ProgressFn): Promise<ParsedBook> {
  onProgress?.({ percent: 1, detail: 'opening PDF' });
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf: Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>;
  try {
    pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'PasswordException') throw new UnreadableError('This PDF is password-protected');
    throw new ParseError('This PDF couldn’t be opened — it may be damaged');
  }

  try {
    const numPages = pdf.numPages;
    let title = titleFromFilename(file.name);
    let author = '';
    try {
      const meta = await pdf.getMetadata();
      const info = (meta.info ?? {}) as Record<string, unknown>;
      const t = typeof info.Title === 'string' ? info.Title : undefined;
      if (!looksLikeJunkTitle(t)) title = cleanInline(t!);
      if (typeof info.Author === 'string' && info.Author.trim()) author = cleanInline(info.Author);
    } catch {
      /* metadata is optional */
    }

    const pageLines: PdfLine[][] = [];
    for (let p = 1; p <= numPages; p++) {
      onProgress?.({ percent: Math.max(1, Math.round(((p - 1) / numPages) * 90)), detail: `extracting text, page ${p} of ${numPages}` });
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      pageLines.push(linesFromItems((content.items as unknown[]).filter((it): it is PdfTextItem => typeof (it as PdfTextItem).str === 'string')));
      page.cleanup();
      if (p % 8 === 0) await yieldToUi();
    }
    const b = new TextBuilder();
    const pageStart = assemblePdfPages(pageLines, b);

    const pagesWithText = b.words.length;
    if (pagesWithText < 20 || (numPages >= 4 && pagesWithText / numPages < 8)) {
      throw new UnreadableError('This PDF is scanned images with no text layer');
    }

    // Chapters from the outline
    onProgress?.({ percent: 96, detail: 'reading outline' });
    try {
      const outline = await pdf.getOutline();
      if (outline && outline.length) {
        type OutlineNode = (typeof outline)[number];
        let nodes: OutlineNode[] = outline;
        if (outline.length <= 2 && outline.some((o) => o.items?.length)) {
          nodes = outline.flatMap((o) => [o, ...(o.items ?? [])]);
        }
        for (const node of nodes) {
          let dest = node.dest;
          if (typeof dest === 'string') dest = await pdf.getDestination(dest);
          if (!Array.isArray(dest) || !dest.length) continue;
          const ref = dest[0];
          let pageIndex: number | null = null;
          if (typeof ref === 'number') pageIndex = ref;
          else if (ref && typeof ref === 'object') pageIndex = await pdf.getPageIndex(ref as Parameters<typeof pdf.getPageIndex>[0]);
          if (pageIndex === null || pageStart[pageIndex] === undefined) continue;
          b.chapters.push({ title: node.title, startWord: Math.min(pageStart[pageIndex], Math.max(0, b.words.length - 1)) });
        }
      }
    } catch {
      /* outline is optional */
    }

    // Cover: render page 1 small
    let cover: Blob | undefined;
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 360 / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, canvas, viewport }).promise;
        cover = (await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))) ?? undefined;
      }
      page.cleanup();
    } catch {
      /* cover is optional */
    }

    onProgress?.({ percent: 100, detail: 'done' });
    return { title, author, cover, ...b.finish() };
  } finally {
    void pdf.destroy();
  }
}
