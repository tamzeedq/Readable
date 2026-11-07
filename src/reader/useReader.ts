// React glue for the reader engine: content loading, engine subscription,
// progress/stats persistence, narration and overlay-driven pausing.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { loadBookContent } from '../lib/bookStorage';
import { Narrator, rateForWpm, ttsSupported } from '../lib/tts';
import { useAppStore } from '../store/appStore';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { Book, BookContent } from '../types';
import { ReaderEngine, clampWpm, type EngineState } from './engine';
import { endsSentence, floorIndex } from './text';

// ---------- content ----------

export type ContentState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; content: BookContent };

export function useBookContent(bookId: string | null): ContentState {
  const [state, setState] = useState<ContentState>({ status: 'loading' });
  useEffect(() => {
    if (!bookId) {
      setState({ status: 'error' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    loadBookContent(bookId)
      .then((content) => {
        if (cancelled) return;
        if (!content || !content.words?.length) setState({ status: 'error' });
        else setState({ status: 'ready', content });
      })
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [bookId]);
  return state;
}

// ---------- engine subscription ----------

/** Subscribe to a slice of engine state. The selector must return a primitive/stable value. */
export function useEngine<T>(engine: ReaderEngine, select: (s: EngineState) => T): T {
  const get = useCallback(() => select(engine.getState()), [engine, select]);
  return useSyncExternalStore(engine.subscribe, get, get);
}

export const selIndex = (s: EngineState) => s.index;
export const selPlaying = (s: EngineState) => s.playing;
export const selWpm = (s: EngineState) => s.wpm;
export const selImage = (s: EngineState) => s.imageIndex;
export const selFinished = (s: EngineState) => s.finished;

// ---------- theme ----------

export function useResolvedDark(): boolean {
  const theme = useAppStore((s) => s.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  return theme === 'system' ? systemDark : theme === 'dark';
}

// ---------- controller ----------

const PROGRESS_PLAYING_MS = 2000;
const PROGRESS_PAUSED_MS = 400;
const STATS_FLUSH_MS = 15000;

export interface ReaderController {
  engine: ReaderEngine;
  setWpm: (wpm: number) => void;
  narration: boolean;
  toggleNarration: () => void;
  narrationSupported: boolean;
  /** Persist progress + stats now (before leaving) */
  flush: () => void;
}

export function useReaderController(book: Book, content: BookContent): ReaderController {
  const readingPrefs = useAppStore((s) => s.readingPrefs);
  const startWpm = book.wpm ?? readingPrefs.defaultWpm;
  const bookId = book.id;

  // One engine per loaded content. Created lazily, survives StrictMode double effects.
  const engine = useMemo(
    () => new ReaderEngine(content, book.progressWordIndex, startWpm),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content],
  );

  // Config from prefs
  useEffect(() => {
    engine.setConfig({
      wordsPerFlash: readingPrefs.wordsPerFlash,
      punctuationPause: readingPrefs.punctuationPause,
      longWordSlowdown: readingPrefs.longWordSlowdown,
      easeIn: readingPrefs.easeIn,
      pauseAtImages: readingPrefs.pauseAtImages && !book.skipImages,
    });
  }, [engine, readingPrefs, book.skipImages]);

  // ---- persistence ----
  const lastSaved = useRef(book.progressWordIndex);
  const saveProgress = useCallback(() => {
    const i = engine.getState().index;
    if (i === lastSaved.current) return;
    lastSaved.current = i;
    useAppStore.getState().setProgress(bookId, i);
  }, [engine, bookId]);

  const flushStats = useCallback(() => {
    const { ms, words } = engine.drainStats();
    if (ms > 0 || words > 0) useAppStore.getState().logReading(bookId, ms, words);
  }, [engine, bookId]);

  const flush = useCallback(() => {
    saveProgress();
    flushStats();
  }, [saveProgress, flushStats]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let wasPlaying = engine.getState().playing;
    const unsub = engine.subscribe(() => {
      const s = engine.getState();
      if (wasPlaying && !s.playing) {
        // paused / image / finished → save immediately
        if (timer) clearTimeout(timer);
        timer = null;
        flush();
      }
      wasPlaying = s.playing;
      if (s.index !== lastSaved.current && !timer) {
        timer = setTimeout(
          () => {
            timer = null;
            saveProgress();
          },
          s.playing ? PROGRESS_PLAYING_MS : PROGRESS_PAUSED_MS,
        );
      }
    });
    const statsTimer = setInterval(() => {
      if (engine.getState().playing) flushStats();
    }, STATS_FLUSH_MS);
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', flush);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
      clearInterval(statsTimer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', flush);
      engine.dispose();
      flush();
    };
  }, [engine, flush, flushStats, saveProgress]);

  // ---- pause when any overlay opens ----
  useEffect(
    () =>
      useAppStore.subscribe((s, prev) => {
        if (s.overlay !== 'none' && s.overlay !== prev.overlay) engine.pause();
      }),
    [engine],
  );

  // ---- speed ----
  const setWpm = useCallback(
    (wpm: number) => {
      const v = clampWpm(wpm);
      engine.setWpm(v);
      useAppStore.getState().updateBook(bookId, { wpm: v });
    },
    [engine, bookId],
  );

  // ---- narration ----
  const [narration, setNarration] = useState(false);
  const narrator = useMemo(() => {
    const { words } = content;
    const paras = content.paragraphStarts;
    const isParaStart = (i: number) => {
      const k = floorIndex(paras, i);
      return k >= 0 && paras[k] === i;
    };
    return new Narrator({
      words,
      chunkEnd: (i) => {
        let j = i + 1;
        while (j < words.length && !endsSentence(words[j - 1]) && !isParaStart(j)) j++;
        return j;
      },
      lang: document.documentElement.lang || undefined,
    });
  }, [content]);

  useEffect(() => {
    const start = (i: number) =>
      narrator.start(i, rateForWpm(engine.getState().wpm), {
        onWord: (w) => engine.advanceTo(w),
        onEnd: () => engine.externalEnd(),
        onError: () => {
          setNarration(false);
        },
      });
    engine.onExternalStart = start;
    engine.onExternalStop = () => narrator.stop();
    // Restart speech at the new rate when the speed changes mid-narration
    let wpm = engine.getState().wpm;
    const unsub = engine.subscribe(() => {
      const s = engine.getState();
      if (s.wpm !== wpm) {
        wpm = s.wpm;
        if (s.playing && engine.isExternal) start(s.index);
      }
    });
    return () => {
      unsub();
      narrator.stop();
      engine.onExternalStart = undefined;
      engine.onExternalStop = undefined;
    };
  }, [engine, narrator]);

  useEffect(() => {
    engine.setExternal(narration);
  }, [engine, narration]);

  const toggleNarration = useCallback(() => {
    if (ttsSupported) setNarration((n) => !n);
  }, []);

  return { engine, setWpm, narration, toggleNarration, narrationSupported: ttsSupported, flush };
}
