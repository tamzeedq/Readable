import { describe, expect, it } from 'vitest';
import {
  bionicLength, endsClause, endsSentence, floorIndex, focalIndex, groupDuration, nextParagraphIndex,
  nextSentenceIndex, orpOffset, paragraphRange, prevParagraphIndex, prevSentenceIndex, sentenceStart, splitWord,
} from './text';

const opts = { wpm: 600, punctuationPause: true, longWordSlowdown: true }; // base 100ms

describe('splitWord / focalIndex', () => {
  it('splits lead, core and trail', () => {
    expect(splitWord('“Hello,”')).toEqual({ lead: '“', core: 'Hello', trail: ',”' });
    expect(splitWord("don't")).toEqual({ lead: '', core: "don't", trail: '' });
  });
  it('handles punctuation-only tokens', () => {
    expect(splitWord('—')).toEqual({ lead: '', core: '—', trail: '' });
  });
  it('maps ORP offsets by length', () => {
    expect([1, 2, 5, 6, 9, 10, 13, 14, 30].map(orpOffset)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it('focal index skips leading punctuation', () => {
    expect(focalIndex('reading')).toBe(2);
    expect(focalIndex('“reading')).toBe(3);
    expect(focalIndex('a')).toBe(0);
    expect(focalIndex('')).toBe(0);
    expect(focalIndex('...')).toBe(1);
  });
});

describe('punctuation classes', () => {
  it('detects sentence ends including closers', () => {
    for (const w of ['end.', 'what?', 'no!', 'wait…', 'said.”', '(see this.)']) expect(endsSentence(w)).toBe(true);
    expect(endsSentence('comma,')).toBe(false);
    expect(endsSentence(undefined)).toBe(false);
  });
  it('detects clause ends', () => {
    expect(endsClause('so,')).toBe(true);
    expect(endsClause('note:')).toBe(true);
    expect(endsClause('plain')).toBe(false);
  });
  it('bionic length is half of core rounded up plus lead', () => {
    expect(bionicLength('reading')).toBe(4);
    expect(bionicLength('“hi')).toBe(2);
  });
});

describe('groupDuration', () => {
  it('uses 60000/wpm per word', () => {
    expect(groupDuration(['a', 'b'], 0, 2, opts, false)).toBeCloseTo(200);
  });
  it('lengthens sentence and clause ends', () => {
    expect(groupDuration(['end.'], 0, 1, opts, false)).toBeCloseTo(220);
    expect(groupDuration(['so,'], 0, 1, opts, false)).toBeCloseTo(160);
  });
  it('adds paragraph pause only with punctuationPause', () => {
    expect(groupDuration(['end.'], 0, 1, opts, true)).toBeCloseTo(330);
    expect(groupDuration(['end.'], 0, 1, { ...opts, punctuationPause: false }, true)).toBeCloseTo(100);
  });
  it('slows long words once per group', () => {
    expect(groupDuration(['extraordinary'], 0, 1, opts, false)).toBeCloseTo(125);
    expect(groupDuration(['extraordinary', 'interesting'], 0, 2, opts, false)).toBeCloseTo(250);
    expect(groupDuration(['extraordinary'], 0, 1, { ...opts, longWordSlowdown: false }, false)).toBeCloseTo(100);
  });
  it('guards against zero wpm', () => {
    expect(Number.isFinite(groupDuration(['a'], 0, 1, { ...opts, wpm: 0 }, false))).toBe(true);
  });
});

describe('search and navigation', () => {
  const words = 'One two. Three four five. Six seven'.split(' ');
  const paras = [0, 5];
  it('floorIndex', () => {
    expect(floorIndex([0, 5, 9], 6)).toBe(1);
    expect(floorIndex([2, 5], 1)).toBe(-1);
    expect(floorIndex([], 1)).toBe(-1);
  });
  it('sentenceStart / prev / next', () => {
    expect(sentenceStart(words, 4, paras)).toBe(2);
    expect(prevSentenceIndex(words, 4, paras)).toBe(2);
    expect(prevSentenceIndex(words, 2, paras)).toBe(0);
    expect(nextSentenceIndex(words, 0, paras)).toBe(2);
    expect(nextSentenceIndex(words, 3, paras)).toBe(5);
    expect(nextSentenceIndex(words, 6, paras)).toBe(6);
  });
  it('paragraph navigation', () => {
    expect(paragraphRange(paras, 6, 7)).toEqual([5, 7]);
    expect(prevParagraphIndex(paras, 6)).toBe(5);
    expect(prevParagraphIndex(paras, 5)).toBe(0);
    expect(nextParagraphIndex(paras, 1, 7)).toBe(5);
    expect(nextParagraphIndex(paras, 6, 7)).toBe(6);
  });
});
