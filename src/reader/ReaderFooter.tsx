import { memo, useMemo } from 'react';
import { HelpCircle, Keyboard } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { Chapter } from '../types';
import { formatNumber, formatTimeLeft } from '../lib/format';
import type { ReaderEngine } from './engine';
import { selFinished, selIndex, selPlaying, selWpm, useEngine } from './useReader';
import { Slider } from './Slider';
import {
  MinusIcon,
  NextParaIcon,
  NextSentenceIcon,
  NextWordIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  PrevParaIcon,
  PrevSentenceIcon,
  PrevWordIcon,
  StopIcon,
} from './icons';
import {
  nextParagraphIndex,
  nextSentenceIndex,
  prevParagraphIndex,
  prevSentenceIndex,
  sentenceStart,
} from './text';

export interface ReaderActions {
  toggle: () => void;
  stop: () => void;
  prevParagraph: () => void;
  nextParagraph: () => void;
  prevSentence: () => void;
  nextSentence: () => void;
  prevWord: () => void;
  nextWord: () => void;
  seek: (i: number) => void;
  setWpm: (wpm: number) => void;
}

export function makeActions(engine: ReaderEngine, setWpm: (wpm: number) => void): ReaderActions {
  const idx = () => engine.getState().index;
  const { words, paragraphStarts } = engine;
  return {
    toggle: () => {
      if (engine.getState().imageIndex !== null) engine.continueFromImage();
      else engine.toggle();
    },
    stop: () => engine.stopAt(sentenceStart(words, idx(), paragraphStarts)),
    prevParagraph: () => engine.seek(prevParagraphIndex(paragraphStarts, idx())),
    nextParagraph: () => engine.seek(nextParagraphIndex(paragraphStarts, idx(), words.length)),
    prevSentence: () => engine.seek(prevSentenceIndex(words, idx(), paragraphStarts)),
    nextSentence: () => engine.seek(nextSentenceIndex(words, idx(), paragraphStarts)),
    prevWord: () => engine.seek(idx() - 1),
    nextWord: () => engine.seek(idx() + engine.groupLength(idx())),
    seek: (i) => engine.seek(i),
    setWpm,
  };
}

// ---------- position ----------

export const PositionSlider = memo(function PositionSlider({
  engine,
  chapters,
  mobile,
}: {
  engine: ReaderEngine;
  chapters: Chapter[];
  mobile: boolean;
}) {
  const index = useEngine(engine, selIndex);
  const max = Math.max(1, engine.wordCount - 1);
  const ticks = useMemo(() => {
    if (mobile || chapters.length < 2) return undefined;
    const t = chapters.filter((c) => c.startWord > 0).map((c) => c.startWord / max);
    // Keep the bar readable for books with hundreds of sections
    if (t.length > 120) return t.filter((_, i) => i % Math.ceil(t.length / 120) === 0);
    return t;
  }, [chapters, max, mobile]);
  const pct = Math.floor((index / max) * 100);
  return (
    <Slider
      label="Position in book"
      value={index}
      min={0}
      max={max}
      pageStep={Math.max(1, Math.round(max / 100))}
      valueText={`${pct}%, word ${formatNumber(index + 1)} of ${formatNumber(engine.wordCount)}`}
      onChange={(v) => engine.seek(v)}
      height={mobile ? 20 : 16}
      thumb={mobile ? 16 : 14}
      ticks={ticks}
    />
  );
});

// ---------- stats ----------

export const ReaderStats = memo(function ReaderStats({ engine, mobile }: { engine: ReaderEngine; mobile: boolean }) {
  const index = useEngine(engine, selIndex);
  const wpm = useEngine(engine, selWpm);
  const finished = useEngine(engine, selFinished);
  const total = engine.wordCount;
  const read = finished ? total : Math.min(total, index + 1);
  const pct = finished ? 100 : Math.floor((index / Math.max(1, total)) * 100);
  const top = finished ? '100% · Finished' : `${pct}% · ${formatTimeLeft(total - index, wpm)} left`;
  if (mobile) {
    return (
      <div className="rd-m-stats">
        <span className="rd-ink">{top}</span>
        <span>
          {formatNumber(read)} / {formatNumber(total)}
        </span>
      </div>
    );
  }
  return (
    <div className="rd-stats">
      <span className="rd-stats-top">{top}</span>
      <span>
        {formatNumber(read)} of {formatNumber(total)} words
      </span>
    </div>
  );
});

// ---------- transport ----------

export const PlayButton = memo(function PlayButton({
  engine,
  actions,
  mobile,
}: {
  engine: ReaderEngine;
  actions: ReaderActions;
  mobile: boolean;
}) {
  const playing = useEngine(engine, selPlaying);
  return (
    <button
      type="button"
      className={mobile ? 'rd-play rd-play-m' : 'rd-play'}
      aria-label={playing ? 'Pause' : 'Play'}
      title={mobile ? undefined : 'Space'}
      onClick={(e) => {
        e.stopPropagation();
        actions.toggle();
      }}
    >
      {playing ? <PauseIcon size={mobile ? 24 : 22} /> : <PlayIcon size={mobile ? 24 : 22} />}
    </button>
  );
});

function TBtn({ label, onClick, children, mobile }: { label: string; onClick: () => void; children: React.ReactNode; mobile?: boolean }) {
  return (
    <button
      type="button"
      className={mobile ? 'rd-tbtn rd-tbtn-m' : 'rd-tbtn'}
      aria-label={label}
      title={mobile ? undefined : label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function Transport({ engine, actions, mobile }: { engine: ReaderEngine; actions: ReaderActions; mobile: boolean }) {
  const showShortcuts = () => useAppStore.getState().openOverlay('shortcuts');
  if (mobile) {
    return (
      <div className="rd-m-transport">
        <TBtn mobile label="Previous sentence" onClick={actions.prevSentence}><PrevSentenceIcon size={20} /></TBtn>
        <TBtn mobile label="Previous word" onClick={actions.prevWord}><PrevWordIcon size={20} /></TBtn>
        <PlayButton engine={engine} actions={actions} mobile />
        <TBtn mobile label="Next word" onClick={actions.nextWord}><NextWordIcon size={20} /></TBtn>
        <TBtn mobile label="Next sentence" onClick={actions.nextSentence}><NextSentenceIcon size={20} /></TBtn>
        <TBtn mobile label="Controls help" onClick={showShortcuts}><HelpCircle size={20} strokeWidth={1.6} aria-hidden="true" /></TBtn>
      </div>
    );
  }
  return (
    <div className="rd-transport">
      <TBtn label="Stop" onClick={actions.stop}><StopIcon /></TBtn>
      <TBtn label="Previous paragraph" onClick={actions.prevParagraph}><PrevParaIcon /></TBtn>
      <TBtn label="Previous sentence" onClick={actions.prevSentence}><PrevSentenceIcon /></TBtn>
      <TBtn label="Previous word" onClick={actions.prevWord}><PrevWordIcon /></TBtn>
      <PlayButton engine={engine} actions={actions} mobile={false} />
      <TBtn label="Next word" onClick={actions.nextWord}><NextWordIcon /></TBtn>
      <TBtn label="Next sentence" onClick={actions.nextSentence}><NextSentenceIcon /></TBtn>
      <TBtn label="Next paragraph" onClick={actions.nextParagraph}><NextParaIcon /></TBtn>
      <TBtn label="Keyboard shortcuts (?)" onClick={showShortcuts}><Keyboard size={18} strokeWidth={1.6} aria-hidden="true" /></TBtn>
    </div>
  );
}

// ---------- speed ----------

const PRESETS: [number, string][] = [
  [250, 'Comfortable'],
  [400, 'Brisk'],
  [600, 'Sprint'],
];

export const SpeedControl = memo(function SpeedControl({
  engine,
  actions,
  mobile,
}: {
  engine: ReaderEngine;
  actions: ReaderActions;
  mobile: boolean;
}) {
  const wpm = useEngine(engine, selWpm);
  return (
    <div className={mobile ? 'rd-speed rd-speed-m' : 'rd-speed'} onClick={(e) => e.stopPropagation()}>
      <div className="rd-presets" role="group" aria-label="Speed presets">
        {PRESETS.map(([v, name]) => (
          <button
            key={v}
            type="button"
            className="rd-pill"
            aria-pressed={wpm === v}
            title={`${name} · ${v} wpm`}
            aria-label={`${name}, ${v} words per minute`}
            onClick={() => actions.setWpm(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="rd-stepper">
        <button type="button" aria-label="Slower" onClick={() => actions.setWpm(wpm - 25)} disabled={wpm <= 50}>
          <MinusIcon />
        </button>
        <div className="rd-stepper-val" aria-live="polite">
          <div className="rd-stepper-num">{wpm}</div>
          <div className="rd-stepper-unit">wpm</div>
        </div>
        <button type="button" aria-label="Faster" onClick={() => actions.setWpm(wpm + 25)} disabled={wpm >= 1000}>
          <PlusIcon />
        </button>
      </div>
    </div>
  );
});

/** 2px (3px mobile) accent line at the very bottom while playing. */
export const BottomProgress = memo(function BottomProgress({ engine, mobile }: { engine: ReaderEngine; mobile: boolean }) {
  const index = useEngine(engine, selIndex);
  const playing = useEngine(engine, selPlaying);
  if (!playing) return null;
  const pct = (index / Math.max(1, engine.wordCount - 1)) * 100;
  return <div className="rd-bottom-progress" aria-hidden="true" style={{ width: `${pct}%`, height: mobile ? 3 : 2 }} />;
});
