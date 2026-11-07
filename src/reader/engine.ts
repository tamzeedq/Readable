// RSVP playback engine. Framework-free: owns the current word index, play state and
// drift-free scheduling. React subscribes through `subscribe`/`getState`
// (see useReader.ts → useEngine).

import type { BookImage } from '../types';
import { endsSentence, floorIndex, groupDuration } from './text';

export interface EngineConfig {
  wordsPerFlash: 1 | 2 | 3;
  punctuationPause: boolean;
  longWordSlowdown: boolean;
  easeIn: boolean;
  /** Effective: readingPrefs.pauseAtImages && !book.skipImages */
  pauseAtImages: boolean;
}

export interface EngineState {
  index: number;
  playing: boolean;
  wpm: number;
  /** Index into `images` while paused at a figure, else null */
  imageIndex: number | null;
  finished: boolean;
}

export interface EngineContent {
  words: string[];
  paragraphStarts: number[];
  images: BookImage[];
}

export const WPM_MIN = 50;
export const WPM_MAX = 1000;
export const clampWpm = (n: number) => Math.max(WPM_MIN, Math.min(WPM_MAX, Math.round(n)));

/** Ease-in ramps from 60 % to full speed over this many ms of playback. */
const EASE_MS = 10000;
const EASE_FROM = 0.6;

export const defaultEngineConfig: EngineConfig = {
  wordsPerFlash: 1,
  punctuationPause: true,
  longWordSlowdown: true,
  easeIn: false,
  pauseAtImages: true,
};

export class ReaderEngine {
  readonly words: string[];
  readonly paragraphStarts: number[];
  readonly images: BookImage[];
  private readonly imageAts: number[];

  private state: EngineState;
  private config: EngineConfig = defaultEngineConfig;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextDue = 0;
  private sessionStart = 0;

  /** When true, an external driver (narration) advances words via advanceTo(). */
  private external = false;
  /** Called when playback (re)starts while externally driven — start narrating from index. */
  onExternalStart?: (index: number) => void;
  /** Called when playback stops while externally driven. */
  onExternalStop?: () => void;

  // Reading stats since last drain
  private segmentStart = 0;
  private pendingMs = 0;
  private pendingWords = 0;

  constructor(content: EngineContent, startIndex: number, wpm: number, config?: Partial<EngineConfig>) {
    this.words = content.words;
    this.paragraphStarts = content.paragraphStarts.length ? content.paragraphStarts : [0];
    this.images = content.images;
    this.imageAts = content.images.map((im) => im.at);
    if (config) this.config = { ...this.config, ...config };
    this.state = {
      index: this.clamp(startIndex),
      playing: false,
      wpm: clampWpm(wpm),
      imageIndex: null,
      finished: false,
    };
  }

  // ---------- subscription ----------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getState = (): EngineState => this.state;

  private set(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  // ---------- config ----------

  setConfig(patch: Partial<EngineConfig>) {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): EngineConfig {
    return this.config;
  }

  get wordCount() {
    return this.words.length;
  }

  private clamp(i: number) {
    return Math.max(0, Math.min(Math.max(0, this.words.length - 1), Math.floor(i) || 0));
  }

  private isParagraphStart(i: number) {
    const k = floorIndex(this.paragraphStarts, i);
    return k >= 0 && this.paragraphStarts[k] === i;
  }

  private imageIndexAt(i: number): number {
    const k = floorIndex(this.imageAts, i);
    if (k < 0 || this.imageAts[k] !== i) return -1;
    // first image at this index
    let j = k;
    while (j > 0 && this.imageAts[j - 1] === i) j--;
    return j;
  }

  /**
   * Number of words flashed together starting at i (1..wordsPerFlash).
   * Groups never span a sentence end, a paragraph break or an image.
   */
  groupLength(i: number): number {
    const n = this.config.wordsPerFlash;
    let len = 1;
    while (len < n && i + len < this.words.length) {
      if (endsSentence(this.words[i + len - 1])) break;
      const nxt = i + len;
      if (this.isParagraphStart(nxt) || this.imageIndexAt(nxt) >= 0) break;
      len++;
    }
    return len;
  }

  private currentDuration(now: number): number {
    const i = this.state.index;
    const len = this.groupLength(i);
    const paragraphEnd = this.isParagraphStart(i + len);
    let d = groupDuration(
      this.words,
      i,
      len,
      {
        wpm: this.state.wpm,
        punctuationPause: this.config.punctuationPause,
        longWordSlowdown: this.config.longWordSlowdown,
      },
      paragraphEnd,
    );
    if (this.config.easeIn) {
      const t = Math.min(1, (now - this.sessionStart) / EASE_MS);
      d /= EASE_FROM + (1 - EASE_FROM) * t;
    }
    return d;
  }

  // ---------- scheduling ----------

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Schedule the advance off the current word. `fresh` restarts the clock (play/seek). */
  private schedule(fresh: boolean) {
    this.clearTimer();
    if (!this.state.playing || this.external) return;
    const now = performance.now();
    const d = this.currentDuration(now);
    // Chain against the ideal due time so setTimeout lateness doesn't accumulate,
    // but never try to "catch up" more than a beat (e.g. after the window was hidden).
    if (fresh || this.nextDue < now - 250) this.nextDue = now + d;
    else this.nextDue += d;
    this.timer = setTimeout(this.tick, Math.max(0, this.nextDue - now));
  }

  private tick = () => {
    this.timer = null;
    if (!this.state.playing) return;
    const i = this.state.index;
    const len = this.groupLength(i);
    this.advance(i + len, len);
    if (this.state.playing) this.schedule(false);
  };

  /** Move playback forward to `next` (counting `advanced` words read). Handles end + images. */
  private advance(next: number, advanced: number) {
    this.pendingWords += Math.max(0, advanced);
    if (next >= this.words.length) {
      this.finish();
      return;
    }
    if (this.config.pauseAtImages) {
      // first image in (index, next]
      const from = this.state.index;
      const k = floorIndex(this.imageAts, from);
      const cand = k + 1;
      if (cand < this.imageAts.length && this.imageAts[cand] <= next) {
        this.stopSegment();
        this.clearTimer();
        this.set({ index: this.imageAts[cand], playing: false, imageIndex: cand });
        this.onStop();
        return;
      }
    }
    this.set({ index: next });
  }

  private stopSegment() {
    if (this.state.playing) this.pendingMs += performance.now() - this.segmentStart;
  }

  private onStop() {
    if (this.external) this.onExternalStop?.();
  }

  private finish() {
    this.stopSegment();
    this.clearTimer();
    this.set({ index: Math.max(0, this.words.length - 1), playing: false, finished: true, imageIndex: null });
    this.onStop();
  }

  // ---------- public controls ----------

  play() {
    if (this.state.playing || !this.words.length) return;
    if (this.state.finished) {
      this.set({ index: 0, finished: false });
    }
    const now = performance.now();
    this.sessionStart = now;
    this.segmentStart = now;
    this.set({ playing: true, imageIndex: null });
    if (this.external) this.onExternalStart?.(this.state.index);
    else this.schedule(true);
  }

  pause() {
    if (!this.state.playing) return;
    this.stopSegment();
    this.clearTimer();
    this.set({ playing: false });
    this.onStop();
  }

  toggle() {
    if (this.state.playing) this.pause();
    else this.play();
  }

  /** Dismiss an image pause and keep reading. */
  continueFromImage() {
    if (this.state.imageIndex === null) return;
    this.set({ imageIndex: null });
    this.play();
  }

  seek(i: number) {
    const index = this.clamp(i);
    if (index === this.state.index && !this.state.finished && this.state.imageIndex === null) return;
    this.set({ index, finished: false, imageIndex: null });
    if (this.state.playing) {
      if (this.external) this.onExternalStart?.(index);
      else this.schedule(true);
    }
  }

  /** Pause and seek. */
  stopAt(i: number) {
    this.pause();
    this.seek(i);
  }

  setWpm(wpm: number) {
    const v = clampWpm(wpm);
    if (v === this.state.wpm) return;
    this.set({ wpm: v });
  }

  // ---------- external driver (narration) ----------

  setExternal(on: boolean) {
    if (on === this.external) return;
    if (this.state.playing) {
      if (on) {
        this.clearTimer();
        this.external = true;
        this.onExternalStart?.(this.state.index);
      } else {
        this.onExternalStop?.();
        this.external = false;
        this.schedule(true);
      }
    } else {
      this.external = on;
    }
  }

  get isExternal() {
    return this.external;
  }

  /** Narration reached word i. */
  advanceTo(i: number) {
    if (!this.state.playing || !this.external) return;
    const from = this.state.index;
    if (i <= from) return;
    this.advance(Math.min(i, this.words.length), i - from);
  }

  /** Narration reached the end of the text. */
  externalEnd() {
    if (!this.state.playing) return;
    this.pendingWords += Math.max(0, this.words.length - this.state.index);
    this.finish();
  }

  // ---------- stats ----------

  /** Reading time (ms) and words advanced since the last drain. */
  drainStats(): { ms: number; words: number } {
    if (this.state.playing) {
      const now = performance.now();
      this.pendingMs += now - this.segmentStart;
      this.segmentStart = now;
    }
    const out = { ms: Math.round(this.pendingMs), words: this.pendingWords };
    this.pendingMs = 0;
    this.pendingWords = 0;
    return out;
  }

  /** Stop timers (unmount). Safe to call more than once; listeners are kept. */
  dispose() {
    this.pause();
    this.clearTimer();
  }
}
