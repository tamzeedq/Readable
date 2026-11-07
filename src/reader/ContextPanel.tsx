import { memo, useMemo } from 'react';
import type { ReaderEngine } from './engine';
import { selIndex, useEngine } from './useReader';
import { bionicLength, paragraphRange } from './text';

const BUCKET = 100;
const BEFORE = 60;
const AFTER = 160;

const ContextWord = memo(function ContextWord({
  text,
  index,
  current,
  bionic,
  onJump,
}: {
  text: string;
  index: number;
  current: boolean;
  bionic: boolean;
  onJump: (i: number) => void;
}) {
  const b = bionic ? bionicLength(text) : 0;
  return (
    <span
      className={current ? 'rd-cw is-current' : 'rd-cw'}
      aria-current={current ? 'true' : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onJump(index);
      }}
    >
      {b > 0 && <b>{text.slice(0, b)}</b>}
      {text.slice(b)}
    </span>
  );
});

/**
 * The current paragraph with the current word marked. Only a window of the paragraph
 * is rendered (books can have very long "paragraphs"), recomputed per 100-word bucket.
 */
export function ContextPanel({
  engine,
  bionic,
  mobile,
  onJump,
}: {
  engine: ReaderEngine;
  bionic: boolean;
  mobile: boolean;
  onJump: (i: number) => void;
}) {
  const index = useEngine(engine, selIndex);
  const [pStart, pEnd] = paragraphRange(engine.paragraphStarts, index, engine.wordCount);
  const bucket = pStart + Math.floor((index - pStart) / BUCKET) * BUCKET;
  const from = Math.max(pStart, bucket - BEFORE);
  const to = Math.min(pEnd, bucket + AFTER);

  const range = useMemo(() => {
    const out: number[] = [];
    for (let i = from; i < to; i++) out.push(i);
    return out;
  }, [from, to]);

  return (
    <section
      className="rd-context"
      aria-label="Context"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rd-context-head">
        <span className="rd-context-label">Context</span>
        <span className="rd-context-hint">
          {mobile ? 'Tap a word to jump' : 'Click any word to jump · Esc to close'}
        </span>
      </div>
      <p className="rd-context-text">
        {from > pStart && <span className="rd-cw-ellipsis">…</span>}
        {range.map((i) => (
          <ContextWord
            key={i}
            text={engine.words[i]}
            index={i}
            current={i === index}
            bionic={bionic}
            onJump={onJump}
          />
        ))}
        {to < pEnd && <span className="rd-cw-ellipsis">…</span>}
      </p>
    </section>
  );
}
