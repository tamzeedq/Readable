// Narration via the Web Speech API, kept in sync with the RSVP engine.
// Speaks one sentence-sized chunk at a time (Chrome cuts long utterances short) and
// reports progress word by word from `boundary` events. Voices that don't emit
// boundary events fall back to an estimated per-word timer within each chunk.

export const ttsSupported =
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  typeof window.SpeechSynthesisUtterance !== 'undefined';

/** Speech rate for a reading speed: ~180 wpm is a natural 1.0. */
export function rateForWpm(wpm: number): number {
  return Math.max(0.5, Math.min(2, wpm / 180));
}

export interface NarrationCallbacks {
  /** The voice reached word `index` */
  onWord: (index: number) => void;
  /** Reached the end of the text */
  onEnd: () => void;
  /** Speech failed (no voices, blocked, …) */
  onError?: () => void;
}

export interface NarratorOptions {
  words: string[];
  /** Exclusive end index of the chunk that starts at `i` (sentence end / paragraph break) */
  chunkEnd: (i: number) => number;
  lang?: string;
}

const MAX_CHUNK = 60;
/** If no boundary event arrives this long after start, estimate word timing instead. */
const BOUNDARY_GRACE_MS = 700;

export class Narrator {
  private gen = 0;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Keep a reference: Chrome garbage-collects utterances mid-speech otherwise. */
  private current: SpeechSynthesisUtterance | null = null;
  /** The utterance being spoken (for debugging / GC pinning) */
  get speaking() {
    return this.current;
  }
  private rate = 1;
  private cb: NarrationCallbacks | null = null;

  constructor(private opts: NarratorOptions) {}

  start(index: number, rate: number, cb: NarrationCallbacks) {
    if (!ttsSupported) {
      cb.onError?.();
      return;
    }
    this.stop();
    this.rate = rate;
    this.cb = cb;
    this.speakFrom(index, ++this.gen);
  }

  stop() {
    this.gen++;
    this.clearTimers();
    this.current = null;
    if (ttsSupported) window.speechSynthesis.cancel();
  }

  private clearTimers() {
    if (this.fallbackTimer !== null) clearInterval(this.fallbackTimer);
    if (this.graceTimer !== null) clearTimeout(this.graceTimer);
    this.fallbackTimer = null;
    this.graceTimer = null;
  }

  private speakFrom(start: number, gen: number) {
    const { words } = this.opts;
    if (gen !== this.gen || !this.cb) return;
    if (start >= words.length) {
      this.cb.onEnd();
      return;
    }
    const end = Math.max(start + 1, Math.min(this.opts.chunkEnd(start), start + MAX_CHUNK, words.length));

    // Build text with char offsets for each word
    const offsets: number[] = [];
    let text = '';
    for (let i = start; i < end; i++) {
      offsets.push(text.length);
      text += (i > start ? ' ' : '') + words[i];
      if (i > start) offsets[offsets.length - 1] += 1;
    }

    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.rate;
    if (this.opts.lang) u.lang = this.opts.lang;
    this.current = u;
    let gotBoundary = false;
    let lastWord = start;

    const report = (i: number) => {
      if (gen !== this.gen || i <= lastWord) return;
      lastWord = i;
      this.cb?.onWord(i);
    };

    u.onboundary = (e) => {
      if (gen !== this.gen) return;
      if (e.name && e.name !== 'word') return;
      gotBoundary = true;
      if (this.fallbackTimer !== null) {
        clearInterval(this.fallbackTimer);
        this.fallbackTimer = null;
      }
      // last offset ≤ charIndex
      let k = 0;
      while (k + 1 < offsets.length && offsets[k + 1] <= e.charIndex) k++;
      report(start + k);
    };

    u.onstart = () => {
      if (gen !== this.gen) return;
      this.graceTimer = setTimeout(() => {
        if (gen !== this.gen || gotBoundary) return;
        // Estimate: ~180 wpm × rate, never passing the chunk's last word.
        const perWord = 60000 / (180 * this.rate);
        this.fallbackTimer = setInterval(() => {
          if (gen !== this.gen) return;
          if (lastWord + 1 < end) report(lastWord + 1);
        }, perWord);
      }, BOUNDARY_GRACE_MS);
    };

    u.onend = () => {
      if (gen !== this.gen) return;
      this.clearTimers();
      if (end >= words.length) {
        this.cb?.onEnd();
        return;
      }
      this.cb?.onWord(end);
      // The engine may have paused (e.g. at an image) inside onWord → stop() bumps gen.
      this.speakFrom(end, gen);
    };

    u.onerror = (e) => {
      if (gen !== this.gen) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      this.clearTimers();
      this.cb?.onError?.();
    };

    window.speechSynthesis.speak(u);
  }
}
