import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeText, normalizeText, parseEpub, parsePastedText, parsePdfTextItems, parsePlainText, parseTxt, titleFromFilename, tokenize } from './parser';
import type { PdfTextItem } from './parser';

const fixture = (name: string) => readFileSync(`src/lib/__fixtures__/${name}`);

describe('tokenize / normalizeText', () => {
  it('strips invisible chars and normalizes newlines', () => {
    expect(normalizeText('a­b​ c\r\nd e')).toBe('ab c\nd e');
  });
  it('attaches stray punctuation to neighbours', () => {
    expect(tokenize('Hello , world !')).toEqual(['Hello,', 'world!']);
    expect(tokenize('“ Well done')).toEqual(['“Well', 'done']);
  });
  it('returns nothing for blank input', () => {
    expect(tokenize('  \n ')).toEqual([]);
  });
});

describe('titleFromFilename', () => {
  it('prettifies file names', () => {
    expect(titleFromFilename('war_and_peace.txt')).toBe('War and Peace');
    expect(titleFromFilename('.txt')).toBe('Untitled');
    expect(titleFromFilename('The Hobbit.txt')).toBe('The Hobbit');
  });
});

describe('parsePlainText / parsePastedText', () => {
  it('uses the supplied title and builds paragraphs', () => {
    const b = parsePastedText('  My Text ', 'First para here.\n\nSecond para here.');
    expect(b.title).toBe('My Text');
    expect(b.words).toEqual(['First', 'para', 'here.', 'Second', 'para', 'here.']);
    expect(b.paragraphStarts).toEqual([0, 3]);
  });
  it('falls back to Untitled for pasted text without a title', () => {
    expect(parsePastedText('', 'just some words').title).toBe('Untitled');
  });
  it('joins wrapped lines and hyphenated breaks', () => {
    const b = parsePlainText('A long sen-\ntence wraps\nacross lines.\n\nNext.', { title: 'T' });
    expect(b.words.slice(0, 5)).toEqual(['A', 'long', 'sentence', 'wraps', 'across']);
  });
  it('detects chapter headings', () => {
    const body = (n: string) => `${n}\n\n` + 'word '.repeat(60).trim() + '.\n\n';
    const b = parsePlainText(body('CHAPTER I.') + body('CHAPTER II.'), { title: 'T' });
    expect(b.chapters.length).toBe(2);
    expect(b.chapters[0].title).toBe('Chapter I.');
    expect(b.chapters[1].startWord).toBeGreaterThan(0);
  });
  it('extracts Project Gutenberg metadata and strips boilerplate', () => {
    const txt = 'Title: Test Book\nAuthor: Jane Doe\n\n*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\n\nReal body text.\n\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***\nlicense junk';
    const b = parsePlainText(txt);
    expect(b.title).toBe('Test Book');
    expect(b.author).toBe('Jane Doe');
    expect(b.words).toEqual(['Real', 'body', 'text.']);
  });
  it('derives title from filename', () => {
    expect(parsePlainText('one two three', { filename: 'my_notes.txt' }).title).toBe('My Notes');
  });
});

describe('decodeText / parseTxt', () => {
  it('decodes UTF-8', () => {
    expect(decodeText(new TextEncoder().encode('café').buffer as ArrayBuffer)).toBe('café');
  });
  it('falls back to windows-1252 for mostly invalid UTF-8', () => {
    const bytes = new Uint8Array(20).fill(0xe9); // é in cp1252, invalid in UTF-8
    expect(decodeText(bytes.buffer)).toBe('é'.repeat(20));
  });
  it('parses a TXT file and reports progress', async () => {
    const file = new File(['Hello world.\n\nBye now.'], 'greeting.txt', { type: 'text/plain' });
    const seen: number[] = [];
    const b = await parseTxt(file, (p) => seen.push(p.percent));
    expect(b.title).toBe('Greeting');
    expect(b.words).toHaveLength(4);
    expect(seen[seen.length - 1]).toBe(100);
  });
});

describe('PDF cleanup (fixture)', () => {
  async function load() {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fixture('running-furniture.pdf')), isEvalSupported: false }).promise;
    const pages: PdfTextItem[][] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(content.items as unknown as PdfTextItem[]);
    }
    return parsePdfTextItems(pages);
  }

  it('drops running headers, page numbers and footnote blocks', async () => {
    const text = (await load()).words.join(' ');
    expect(text).not.toMatch(/SYNTHETIC|TREATISE/i);
    expect(text).not.toMatch(/\bPage \d/);
    expect(text).not.toContain('footnote');
    expect(text).toContain('reading speed and comfort for every kind of reader.');
  });

  it('rejoins hyphenated line breaks but keeps real hyphens', async () => {
    const words = (await load()).words;
    expect(words).toContain('recognition');
    expect(words).toContain('example');
    expect(words).toContain('well-known');
    expect(words).toContain('state-of-the-art');
    expect(words).not.toContain('recog-');
  });

  it('strips glued footnote markers and keeps paragraph breaks', async () => {
    const r = await load();
    expect(r.words).toContain('comfort');
    expect(r.words).not.toContain('comfort1');
    expect(r.paragraphStarts.length).toBeGreaterThanOrEqual(4);
  });
});

describe('EPUB cleanup (fixture)', () => {
  async function load() {
    const file = new File([new Uint8Array(fixture('notes.epub'))], 'notes.epub');
    return parseEpub(file);
  }

  it('keeps footnote and endnote bodies and markers out of the text', async () => {
    const b = await load();
    const text = b.words.join(' ');
    expect(text).not.toMatch(/FOOTNOTEBODY|ENDNOTEBODY/);
    expect(text).not.toMatch(/SECRETHIDDEN|ARIAHIDDEN/);
    expect(b.words).toContain('follows');
    expect(b.words).not.toContain('follows2');
    expect(b.words).toContain('patience.');
    expect(b.words).toContain('endnote.');
    expect(b.words).not.toContain('endnote.3');
  });

  it('removes soft hyphens and non-breaking spaces, keeps real hyphens and non-note superscripts', async () => {
    const b = await load();
    expect(b.words.join('')).not.toContain('\u00AD');
    expect(b.words.join('')).not.toContain('\u00A0');
    expect(b.words).toContain('reading');
    expect(b.words).toContain('it');
    expect(b.words).toContain('well-known');
    expect(b.words).toContain('state-of-the-art');
    expect(b.words.join(' ')).toContain('102 is kept');
  });

  it('builds chapters from the TOC without a notes entry', async () => {
    const b = await load();
    expect(b.chapters.map((c) => c.title)).toEqual(['First Chapter', 'Second Chapter']);
  });
});
