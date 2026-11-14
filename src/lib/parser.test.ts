import { describe, expect, it } from 'vitest';
import { decodeText, normalizeText, parsePastedText, parsePlainText, parseTxt, titleFromFilename, tokenize } from './parser';

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
