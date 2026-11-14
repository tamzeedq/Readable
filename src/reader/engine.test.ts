import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clampWpm, ReaderEngine, WPM_MAX, WPM_MIN } from './engine';

const words = ['one', 'two', 'three.', 'four', 'five', 'six'];
const content = (images: { at: number }[] = [], paragraphStarts = [0]) =>
  ({ words, paragraphStarts, images: images as never[] });
const plain = { punctuationPause: false, longWordSlowdown: false };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('clampWpm', () => {
  it('clamps and rounds', () => {
    expect(clampWpm(1)).toBe(WPM_MIN);
    expect(clampWpm(99999)).toBe(WPM_MAX);
    expect(clampWpm(300.6)).toBe(301);
  });
});

describe('ReaderEngine', () => {
  it('clamps the start index', () => {
    expect(new ReaderEngine(content(), 99, 300).getState().index).toBe(5);
    expect(new ReaderEngine(content(), -3, 300).getState().index).toBe(0);
  });

  it('advances at wpm pace', () => {
    const e = new ReaderEngine(content(), 0, 600, plain); // 100ms/word
    e.play();
    expect(e.getState().playing).toBe(true);
    vi.advanceTimersByTime(100);
    expect(e.getState().index).toBe(1);
    vi.advanceTimersByTime(200);
    expect(e.getState().index).toBe(3);
  });

  it('pauses longer after sentence end', () => {
    const e = new ReaderEngine(content(), 2, 600, { ...plain, punctuationPause: true });
    e.play();
    vi.advanceTimersByTime(200);
    expect(e.getState().index).toBe(2);
    vi.advanceTimersByTime(30);
    expect(e.getState().index).toBe(3);
  });

  it('pause stops advancing and toggle resumes', () => {
    const e = new ReaderEngine(content(), 0, 600, plain);
    e.play();
    e.pause();
    vi.advanceTimersByTime(1000);
    expect(e.getState().index).toBe(0);
    e.toggle();
    expect(e.getState().playing).toBe(true);
  });

  it('finishes at the end, and replays from the start', () => {
    const e = new ReaderEngine(content(), 4, 600, plain);
    e.play();
    vi.advanceTimersByTime(500);
    expect(e.getState()).toMatchObject({ finished: true, playing: false, index: 5 });
    e.play();
    expect(e.getState()).toMatchObject({ finished: false, playing: true, index: 0 });
  });

  it('groups words but not across sentence ends', () => {
    const e = new ReaderEngine(content(), 0, 600, { ...plain, wordsPerFlash: 3 });
    expect(e.groupLength(0)).toBe(3); // one two three.
    expect(e.groupLength(1)).toBe(2); // two three. | stops at sentence end
    expect(e.groupLength(3)).toBe(3);
  });

  it('groups stop at paragraph starts', () => {
    const e = new ReaderEngine(content([], [0, 1]), 0, 600, { ...plain, wordsPerFlash: 3 });
    expect(e.groupLength(0)).toBe(1);
  });

  it('seek clamps and notifies subscribers', () => {
    const e = new ReaderEngine(content(), 0, 300);
    const fn = vi.fn();
    const off = e.subscribe(fn);
    e.seek(3.9);
    expect(e.getState().index).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    e.seek(1);
    expect(fn).toHaveBeenCalledTimes(1);
    e.seek(100);
    expect(e.getState().index).toBe(5);
  });

  it('setWpm clamps', () => {
    const e = new ReaderEngine(content(), 0, 300);
    e.setWpm(5000);
    expect(e.getState().wpm).toBe(WPM_MAX);
  });

  it('pauses at images and continues', () => {
    const e = new ReaderEngine(content([{ at: 2 }]), 0, 600, plain);
    e.play();
    vi.advanceTimersByTime(1000);
    expect(e.getState()).toMatchObject({ index: 2, playing: false, imageIndex: 0 });
    e.continueFromImage();
    expect(e.getState()).toMatchObject({ playing: true, imageIndex: null });
    vi.advanceTimersByTime(100);
    expect(e.getState().index).toBe(3);
  });

  it('does not pause at images when disabled', () => {
    const e = new ReaderEngine(content([{ at: 2 }]), 0, 600, { ...plain, pauseAtImages: false });
    e.play();
    vi.advanceTimersByTime(250);
    expect(e.getState().index).toBe(2);
    expect(e.getState().playing).toBe(true);
  });

  it('external driver advances via advanceTo without timers', () => {
    const e = new ReaderEngine(content(), 0, 600, plain);
    const start = vi.fn();
    e.onExternalStart = start;
    e.setExternal(true);
    e.play();
    expect(start).toHaveBeenCalledWith(0);
    vi.advanceTimersByTime(1000);
    expect(e.getState().index).toBe(0);
    e.advanceTo(3);
    expect(e.getState().index).toBe(3);
    e.externalEnd();
    expect(e.getState().finished).toBe(true);
  });

  it('drainStats reports words and resets', () => {
    const e = new ReaderEngine(content(), 0, 600, plain);
    e.play();
    vi.advanceTimersByTime(300);
    const s = e.drainStats();
    expect(s.words).toBe(3);
    expect(s.ms).toBeGreaterThanOrEqual(0);
    expect(e.drainStats().words).toBe(0);
  });
});
