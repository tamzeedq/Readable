import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ReaderEngine } from './engine';
import { selIndex, useEngine } from './useReader';
import { bionicLength, focalIndex, splitWord } from './text';

export interface StageLook {
  size: number;
  ghostCount: number; // 0 = off
  guides: boolean;
  bionic: boolean;
  mobile: boolean;
}

interface Flash {
  text: string;
  focal: number;
  /** [start, end) bold ranges in `text` (bionic) */
  bold: [number, number][];
}

/** Build the flashed string for a group of words and choose its focal letter. */
export function buildFlash(words: string[], bionic: boolean): Flash {
  if (words.length === 1) {
    const w = words[0] ?? '';
    return { text: w, focal: focalIndex(w), bold: bionic ? [[0, bionicLength(w)]] : [] };
  }
  let text = '';
  const bold: [number, number][] = [];
  const starts: number[] = [];
  words.forEach((w, k) => {
    if (k) text += ' ';
    starts.push(text.length);
    if (bionic) bold.push([text.length, text.length + bionicLength(w)]);
    text += w;
  });
  // Phrase ORP: ~35 % into the phrase, snapped to a letter of the word it falls in.
  const target = Math.floor(text.length * 0.35);
  let k = 0;
  while (k + 1 < starts.length && starts[k + 1] <= target) k++;
  const w = words[k];
  const { lead, core } = splitWord(w);
  const within = Math.min(Math.max(target - starts[k], lead.length), lead.length + Math.max(0, core.length - 1));
  return { text, focal: starts[k] + within, bold };
}

/** Render text[from, to) with bold ranges as <b>. */
function renderRange(text: string, from: number, to: number, bold: [number, number][]): ReactNode[] {
  const out: ReactNode[] = [];
  let pos = from;
  for (const [s, e] of bold) {
    const bs = Math.max(s, from);
    const be = Math.min(e, to);
    if (be <= bs) continue;
    if (bs > pos) out.push(text.slice(pos, bs));
    out.push(<b key={bs}>{text.slice(bs, be)}</b>);
    pos = be;
  }
  if (pos < to) out.push(text.slice(pos, to));
  return out;
}

/** The RSVP word: 3-column grid so the focal letter's x-position never moves. */
export const WordStage = memo(function WordStage({ engine, look }: { engine: ReaderEngine; look: StageLook }) {
  const index = useEngine(engine, selIndex);
  const words = engine.words;
  const len = engine.groupLength(index);
  const group = words.slice(index, index + len);
  const flash = buildFlash(group, look.bionic);

  const prev = look.ghostCount ? words.slice(Math.max(0, index - look.ghostCount), index).join(' ') : '';
  const next = look.ghostCount ? words.slice(index + len, index + len + look.ghostCount).join(' ') : '';

  // Shrink long words so both halves fit their cells.
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const side = Math.max(flash.focal, flash.text.length - flash.focal - 1) + 0.5;
  const fit = width ? (width / 2 - 8) / (side * 0.62) : look.size;
  const size = Math.max(16, Math.min(look.size, fit));

  const pre = renderRange(flash.text, 0, flash.focal, flash.bold);
  const post = renderRange(flash.text, flash.focal + 1, flash.text.length, flash.bold);
  const guideH = look.mobile ? 14 : 18;
  const guideGap = look.mobile ? 24 : 34;

  return (
    <div
      ref={ref}
      className="rd-word"
      aria-hidden="true"
      style={{ fontSize: size }}
    >
      <div className="rd-word-left">
        {prev && <span className="rd-ghost">{prev}</span>}
        <span>{pre}</span>
      </div>
      <div className="rd-word-focal">
        <span
          className="rd-guide"
          style={{ top: -guideGap, height: guideH, opacity: look.guides ? 0.55 : 0 }}
        />
        {flash.text[flash.focal] ?? ''}
        <span
          className="rd-guide"
          style={{ bottom: -guideGap, height: guideH, opacity: look.guides ? 0.55 : 0 }}
        />
      </div>
      <div className="rd-word-right">
        <span>{post}</span>
        {next && <span className="rd-ghost">{next}</span>}
      </div>
    </div>
  );
});

/** Screen-reader status: announces the current word + position when paused. */
export function StageStatus({ engine, playing }: { engine: ReaderEngine; playing: boolean }) {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (playing) return;
    const s = engine.getState();
    const w = engine.words[s.index] ?? '';
    setMsg(`Paused at “${w}”, word ${s.index + 1} of ${engine.wordCount}`);
  }, [engine, playing]);
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {playing ? '' : msg}
    </div>
  );
}
