// Pure text helpers for the RSVP reader: ORP focal index, punctuation classes,
// bionic splitting, sentence/paragraph navigation and per-word timing.
// Everything here is framework-free so it can be unit tested in isolation.

const LEAD_RE = /^[^\p{L}\p{N}]*/u;
const TRAIL_RE = /[^\p{L}\p{N}]*$/u;

/** Closing quotes / brackets that may follow terminal punctuation: `end.”`, `(see this.)` */
const CLOSERS = `"'”’»)\\]}›`;
const SENTENCE_END_RE = new RegExp(`[.;!?…][${CLOSERS}]*$`);
const CLAUSE_END_RE = new RegExp(`[,:—–][${CLOSERS}]*$`);

export interface WordParts {
  /** Leading punctuation (opening quotes, brackets) */
  lead: string;
  /** Letters/digits, including inner apostrophes and hyphens */
  core: string;
  /** Trailing punctuation */
  trail: string;
}

export function splitWord(word: string): WordParts {
  const lead = LEAD_RE.exec(word)?.[0] ?? '';
  if (lead.length === word.length) return { lead: '', core: word, trail: '' };
  const rest = word.slice(lead.length);
  const trail = TRAIL_RE.exec(rest)?.[0] ?? '';
  return { lead, core: rest.slice(0, rest.length - trail.length), trail };
}

/** Optimal recognition point offset into the core (README: ≤1→0, ≤5→1, ≤9→2, ≤13→3, else 4). */
export function orpOffset(coreLength: number): number {
  if (coreLength <= 1) return 0;
  if (coreLength <= 5) return 1;
  if (coreLength <= 9) return 2;
  if (coreLength <= 13) return 3;
  return 4;
}

/**
 * Index of the focal letter within the full display token.
 * Leading quotes/brackets are skipped so the count starts at the first letter.
 * Works on UTF-16 code units; fine for the Latin texts this app targets.
 */
export function focalIndex(word: string): number {
  if (!word) return 0;
  const { lead, core } = splitWord(word);
  if (!core) return 0;
  return lead.length + Math.min(orpOffset(core.length), core.length - 1);
}

export function endsSentence(word: string | undefined): boolean {
  return !!word && SENTENCE_END_RE.test(word);
}

export function endsClause(word: string | undefined): boolean {
  return !!word && CLAUSE_END_RE.test(word);
}

/** Number of characters to embolden in bionic mode: ⌈core/2⌉ counted from the token start (incl. lead). */
export function bionicLength(word: string): number {
  const { lead, core } = splitWord(word);
  return lead.length + Math.ceil(core.length / 2);
}

// ---------- Timing ----------

export interface TimingOptions {
  wpm: number;
  punctuationPause: boolean;
  longWordSlowdown: boolean;
}

/**
 * Display duration (ms) for a group of `count` words starting at `start`.
 * Base 60000/wpm per word; punctuation multipliers come from the group's last word,
 * the long-word multiplier applies if any word in the group has a core > 8 letters.
 * `paragraphEnd` adds ×1.5 under punctuationPause.
 */
export function groupDuration(
  words: string[],
  start: number,
  count: number,
  opts: TimingOptions,
  paragraphEnd: boolean,
): number {
  const base = 60000 / Math.max(1, opts.wpm);
  let d = base * count;
  const last = words[start + count - 1];
  if (opts.punctuationPause) {
    if (endsSentence(last)) d *= 2.2;
    else if (endsClause(last)) d *= 1.6;
    if (paragraphEnd) d *= 1.5;
  }
  if (opts.longWordSlowdown) {
    for (let k = start; k < start + count; k++) {
      if (splitWord(words[k] ?? '').core.length > 8) {
        d *= 1.25;
        break;
      }
    }
  }
  return d;
}

// ---------- Search helpers ----------

/** Index of the last element in sorted `arr` that is ≤ value (−1 if none). */
export function floorIndex(arr: number[], value: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= value) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** First element in sorted `arr` strictly greater than value, or undefined. */
export function nextAfter(arr: number[], value: number): number | undefined {
  const i = floorIndex(arr, value);
  return arr[i + 1];
}

// ---------- Navigation ----------

/** Safety bound for texts without punctuation */
const MAX_SENTENCE = 400;

/** Start of the sentence containing word i. */
export function sentenceStart(words: string[], i: number, paragraphStarts: number[]): number {
  const paraStart = Math.max(paragraphStarts[floorIndex(paragraphStarts, i)] ?? 0, i - MAX_SENTENCE);
  let j = Math.max(0, i);
  while (j > paraStart && !endsSentence(words[j - 1])) j--;
  return j;
}

/** Previous: start of the current sentence, or the previous one if already at its start. */
export function prevSentenceIndex(words: string[], i: number, paragraphStarts: number[]): number {
  const s = sentenceStart(words, i, paragraphStarts);
  if (s === i && i > 0) return sentenceStart(words, i - 1, paragraphStarts);
  return s;
}

/** Next: first word after the next terminal punctuation (or the next paragraph start). */
export function nextSentenceIndex(words: string[], i: number, paragraphStarts: number[]): number {
  const last = words.length - 1;
  const nextPara = nextAfter(paragraphStarts, i) ?? Infinity;
  const limit = i + MAX_SENTENCE;
  let j = i + 1;
  while (j < last && j < nextPara && j < limit && !endsSentence(words[j - 1])) j++;
  return Math.min(j, last);
}

export function paragraphIndexOf(paragraphStarts: number[], i: number): number {
  return Math.max(0, floorIndex(paragraphStarts, i));
}

/** Previous paragraph: start of the current paragraph, or the previous one if already there. */
export function prevParagraphIndex(paragraphStarts: number[], i: number): number {
  const p = paragraphIndexOf(paragraphStarts, i);
  const start = paragraphStarts[p] ?? 0;
  if (start < i) return start;
  return paragraphStarts[Math.max(0, p - 1)] ?? 0;
}

export function nextParagraphIndex(paragraphStarts: number[], i: number, wordCount: number): number {
  return nextAfter(paragraphStarts, i) ?? Math.max(0, wordCount - 1);
}

/** Paragraph [start, end) containing i. */
export function paragraphRange(paragraphStarts: number[], i: number, wordCount: number): [number, number] {
  const p = paragraphIndexOf(paragraphStarts, i);
  const start = paragraphStarts[p] ?? 0;
  const end = paragraphStarts[p + 1] ?? wordCount;
  return [start, end];
}
