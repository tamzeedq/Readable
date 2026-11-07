import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAppStore, useAppearance, useBook } from '../store/appStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { Book, BookContent, Chapter } from '../types';
import type { ReaderEngine } from './engine';
import {
  selFinished,
  selImage,
  selIndex,
  selPlaying,
  useBookContent,
  useEngine,
  useReaderController,
  useResolvedDark,
} from './useReader';
import { StageStatus, WordStage, type StageLook } from './WordStage';
import { ContextPanel } from './ContextPanel';
import { ImagePause } from './ImagePause';
import { AppearancePanel, MOBILE_SIZE, typefaceFamily } from './AppearancePanel';
import {
  BottomProgress,
  PositionSlider,
  ReaderStats,
  SpeedControl,
  Transport,
  makeActions,
  type ReaderActions,
} from './ReaderFooter';
import {
  AppearanceIcon,
  BackIcon,
  BookmarkIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  NarrationIcon,
} from './icons';
import { floorIndex } from './text';
import './reader.css';

const HIDE_AFTER_MS = 2000;

export function ReaderScreen() {
  const bookId = useAppStore((s) => s.activeBookId);
  const book = useBook(bookId);
  const content = useBookContent(book ? book.id : null);

  if (!book || content.status === 'error') {
    return (
      <ReaderMessage
        title={book ? 'This book can’t be opened' : 'Nothing to read'}
        body={
          book
            ? 'Its text wasn’t found on this device. Try removing it and adding the file again.'
            : 'Choose a book from your library to start reading.'
        }
      />
    );
  }
  if (content.status === 'loading') {
    return (
      <div className="rd-root rd-center" aria-busy="true">
        <p className="rd-loading">Opening {book.title}…</p>
      </div>
    );
  }
  return <ReaderView key={book.id} book={book} content={content.content} />;
}

function ReaderMessage({ title, body }: { title: string; body: string }) {
  const openLibrary = useAppStore((s) => s.openLibrary);
  return (
    <div className="rd-root rd-center">
      <div className="rd-message">
        <h1>{title}</h1>
        <p>{body}</p>
        <button type="button" className="rd-btn-primary" onClick={() => openLibrary()}>
          Back to library
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReaderView({ book, content }: { book: Book; content: BookContent }) {
  const ctrl = useReaderController(book, content);
  const { engine } = ctrl;
  const actions = useMemo(() => makeActions(engine, ctrl.setWpm), [engine, ctrl.setWpm]);

  const mobile = useIsMobile();
  const dark = useResolvedDark();
  const ap = useAppearance(book.id);
  const readingPrefs = useAppStore((s) => s.readingPrefs);
  const overlay = useAppStore((s) => s.overlay);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const openLibrary = useAppStore((s) => s.openLibrary);
  const updateBook = useAppStore((s) => s.updateBook);

  const playing = useEngine(engine, selPlaying);
  const imageIndex = useEngine(engine, selImage);
  const finished = useEngine(engine, selFinished);
  const appearanceOpen = overlay === 'appearance';

  // ---- context visibility (Esc while paused dismisses until next play) ----
  const [contextDismissed, setContextDismissed] = useState(false);
  useEffect(() => {
    if (playing) setContextDismissed(false);
  }, [playing]);
  const showContext =
    imageIndex === null &&
    !finished &&
    !contextDismissed &&
    (ap.contextAlways || (!playing && ap.contextWhenPaused));
  const showContextRef = useRef(showContext);
  showContextRef.current = showContext;

  // ---- chrome auto-hide ----
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHide = playing && readingPrefs.hideControls === '2s' && !appearanceOpen;
  const armHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    if (!autoHide) return;
    hideTimer.current = setTimeout(() => setChromeVisible(false), HIDE_AFTER_MS);
  }, [autoHide]);
  useEffect(() => {
    setChromeVisible(true);
    armHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [armHide]);
  const lastMove = useRef(0);
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || !autoHide) return;
    const now = performance.now();
    if (chromeVisible && now - lastMove.current < 150) return;
    lastMove.current = now;
    if (!chromeVisible) setChromeVisible(true);
    armHide();
  };
  const chromeHidden = autoHide && !chromeVisible;

  // ---- navigation ----
  const goBack = useCallback(() => {
    engine.pause();
    ctrl.flush();
    openLibrary();
  }, [engine, ctrl, openLibrary]);

  const continueImage = useCallback(() => engine.continueFromImage(), [engine]);
  const skipImages = useCallback(() => {
    updateBook(book.id, { skipImages: true });
    engine.setConfig({ pauseAtImages: false });
    engine.continueFromImage();
  }, [engine, updateBook, book.id]);

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
      const ov = useAppStore.getState().overlay;
      if (ov !== 'none' && ov !== 'appearance') return;
      if (ov === 'appearance' && (e.key === 'Escape' || t?.closest?.('.rd-ap-popover, .rd-ap-sheet'))) return;

      const s = engine.getState();
      if (s.imageIndex !== null) {
        if (e.key === ' ') {
          e.preventDefault();
          engine.continueFromImage();
        }
        return;
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          actions.toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          actions.prevWord();
          break;
        case 'ArrowRight':
          e.preventDefault();
          actions.nextWord();
          break;
        case 'ArrowUp':
        case '+':
        case '=':
          e.preventDefault();
          actions.setWpm(s.wpm + 25);
          break;
        case 'ArrowDown':
        case '-':
          e.preventDefault();
          actions.setWpm(s.wpm - 25);
          break;
        case 'Escape':
          if (s.playing) engine.pause();
          else if (showContextRef.current) setContextDismissed(true);
          break;
        default:
          return;
      }
      // Any reader key counts as activity for the chrome
      if (e.key !== ' ') {
        setChromeVisible(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, actions]);

  // ---- fullscreen ----
  const [fullscreen, setFullscreen] = useFullscreen();

  // ---- appearance-derived styles ----
  const focal = ap.focalColor
    ? dark
      ? `color-mix(in oklch, ${ap.focalColor}, white 40%)`
      : ap.focalColor
    : undefined;
  const rootStyle = {
    '--reader': typefaceFamily(ap.typeface),
    ...(focal ? { '--focal': focal } : {}),
  } as CSSProperties;

  const look: StageLook = useMemo(
    () =>
      mobile
        ? {
            size: ap.mobileWordSize ?? MOBILE_SIZE.def,
            ghostCount: (ap.mobileGhostWords ?? false) ? 1 : 0,
            guides: ap.focusGuides,
            bionic: ap.bionic,
            mobile: true,
          }
        : {
            size: ap.wordSize,
            ghostCount: ap.ghostWords ? 2 : 0,
            guides: ap.focusGuides,
            bionic: ap.bionic,
            mobile: false,
          },
    [mobile, ap.mobileWordSize, ap.mobileGhostWords, ap.wordSize, ap.ghostWords, ap.focusGuides, ap.bionic],
  );

  const onStageTap = () => {
    if (!mobile) return;
    if (chromeHidden) {
      setChromeVisible(true);
      armHide();
      return;
    }
    actions.toggle();
  };

  const image = imageIndex !== null ? engine.images[imageIndex] : undefined;
  const showTapHint = mobile && !playing && !ap.contextWhenPaused && !ap.contextAlways && !image && !finished;

  const stage = (
    <div
      className={`rd-stage ${mobile ? 'rd-stage-m' : ''}`}
      onClick={onStageTap}
      aria-live="off"
    >
      {image ? (
        <ImagePause image={image} mobile={mobile} onContinue={continueImage} onSkip={skipImages} />
      ) : finished ? (
        <FinishedCard title={book.title} onBack={goBack} onRestart={() => engine.seek(0)} />
      ) : (
        <>
          <WordStage engine={engine} look={look} />
          {showContext && (
            <ContextPanel engine={engine} bionic={ap.bionic} mobile={mobile} onJump={actions.seek} />
          )}
          {showTapHint && <div className="rd-tap-hint">Tap anywhere to play or pause</div>}
        </>
      )}
    </div>
  );

  return (
    <div
      className={`rd-root ${mobile ? 'rd-mobile' : 'rd-desktop'} ${chromeHidden ? 'is-chrome-hidden' : ''}`}
      style={rootStyle}
      onPointerMove={onPointerMove}
    >
      <StageStatus engine={engine} playing={playing} />
      <ReaderHeader
        engine={engine}
        book={book}
        mobile={mobile}
        narration={ctrl.narration}
        narrationSupported={ctrl.narrationSupported}
        onToggleNarration={ctrl.toggleNarration}
        appearanceOpen={appearanceOpen}
        onAppearance={() => (appearanceOpen ? closeOverlay() : openOverlay('appearance'))}
        fullscreen={fullscreen}
        onFullscreen={() => setFullscreen(!fullscreen)}
        onBack={goBack}
      />
      {stage}
      <ReaderFooterBar engine={engine} actions={actions} chapters={book.chapters} mobile={mobile} />
      <BottomProgress engine={engine} mobile={mobile} />
      {appearanceOpen && <AppearancePanel bookId={book.id} mobile={mobile} onClose={closeOverlay} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function useFullscreen(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  const viaTauri = useRef(false);
  useEffect(() => {
    const onChange = () => setOn(!!document.fullscreenElement || viaTauri.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      // Leave full screen when the reader closes
      if (viaTauri.current) {
        void import('@tauri-apps/api/window')
          .then(({ getCurrentWindow }) => getCurrentWindow().setFullscreen(false))
          .catch(() => {});
      } else if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);
  const set = useCallback((next: boolean) => {
    void (async () => {
      if ('__TAURI_INTERNALS__' in window) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().setFullscreen(next);
          viaTauri.current = next;
          setOn(next);
          return;
        } catch {
          // Missing permission (core:window:allow-set-fullscreen) → DOM API below
        }
      }
      try {
        if (next && !document.fullscreenElement) await document.documentElement.requestFullscreen();
        else if (!next && document.fullscreenElement) await document.exitFullscreen();
      } catch {
        /* not allowed */
      }
    })();
  }, []);
  return [on, set];
}

// ---------------------------------------------------------------------------

const ChapterTitle = memo(function ChapterTitle({
  engine,
  chapters,
  fallback,
}: {
  engine: ReaderEngine;
  chapters: Chapter[];
  fallback: string;
}) {
  const starts = useMemo(() => chapters.map((c) => c.startWord), [chapters]);
  const sel = useCallback((s: { index: number }) => floorIndex(starts, s.index), [starts]);
  const k = useEngine(engine, sel);
  return <>{chapters[k]?.title || fallback}</>;
});

const BookmarkButton = memo(function BookmarkButton({
  engine,
  bookId,
  bookmarks,
  mobile,
}: {
  engine: ReaderEngine;
  bookId: string;
  bookmarks: number[];
  mobile: boolean;
}) {
  const index = useEngine(engine, selIndex);
  const on = bookmarks.includes(index);
  const toggle = useAppStore((s) => s.toggleBookmark);
  return (
    <button
      type="button"
      className={mobile ? 'rd-hbtn rd-hbtn-m' : 'rd-hbtn'}
      aria-label={on ? 'Remove bookmark' : 'Add bookmark'}
      aria-pressed={on}
      title={mobile ? undefined : on ? 'Remove bookmark' : 'Add bookmark'}
      onClick={() => toggle(bookId, engine.getState().index)}
    >
      <BookmarkIcon size={mobile ? 20 : 19} filled={on} />
    </button>
  );
});

function ReaderHeader({
  engine,
  book,
  mobile,
  narration,
  narrationSupported,
  onToggleNarration,
  appearanceOpen,
  onAppearance,
  fullscreen,
  onFullscreen,
  onBack,
}: {
  engine: ReaderEngine;
  book: Book;
  mobile: boolean;
  narration: boolean;
  narrationSupported: boolean;
  onToggleNarration: () => void;
  appearanceOpen: boolean;
  onAppearance: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onBack: () => void;
}) {
  const sub = <ChapterTitle engine={engine} chapters={book.chapters} fallback={book.author} />;
  if (mobile) {
    return (
      <header className="rd-header rd-header-m rd-chrome">
        <button type="button" className="rd-hbtn rd-hbtn-m" aria-label="Back to library" onClick={onBack}>
          <BackIcon size={22} strokeWidth={1.7} />
        </button>
        <div className="rd-title">
          <div className="rd-title-main">{book.title}</div>
          <div className="rd-title-sub">{sub}</div>
        </div>
        <div className="rd-header-actions">
          <BookmarkButton engine={engine} bookId={book.id} bookmarks={book.bookmarks} mobile />
          <button
            type="button"
            className="rd-hbtn rd-hbtn-m"
            aria-label="Reading appearance"
            aria-expanded={appearanceOpen}
            data-rd-appearance-toggle=""
            onClick={onAppearance}
          >
            <AppearanceIcon size={21} />
          </button>
        </div>
      </header>
    );
  }
  return (
    <header className="rd-header rd-chrome">
      <button type="button" className="rd-back" onClick={onBack}>
        <BackIcon />
        Library
      </button>
      <div className="rd-title">
        <div className="rd-title-main">{book.title}</div>
        <div className="rd-title-sub">{sub}</div>
      </div>
      <div className="rd-header-actions">
        <BookmarkButton engine={engine} bookId={book.id} bookmarks={book.bookmarks} mobile={false} />
        <button
          type="button"
          className="rd-hbtn"
          aria-label="Narration"
          aria-pressed={narration}
          disabled={!narrationSupported}
          title={narrationSupported ? (narration ? 'Narration on' : 'Narration') : 'Narration isn’t available on this device'}
          onClick={onToggleNarration}
        >
          <NarrationIcon />
        </button>
        <button
          type="button"
          className="rd-hbtn"
          aria-label="Reading appearance"
          aria-expanded={appearanceOpen}
          aria-haspopup="dialog"
          data-rd-appearance-toggle=""
          title="Appearance"
          onClick={onAppearance}
        >
          <AppearanceIcon />
        </button>
        <button
          type="button"
          className="rd-hbtn"
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          aria-pressed={fullscreen}
          title={fullscreen ? 'Exit full screen' : 'Full screen'}
          onClick={onFullscreen}
        >
          {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        </button>
      </div>
    </header>
  );
}

function ReaderFooterBar({
  engine,
  actions,
  chapters,
  mobile,
}: {
  engine: ReaderEngine;
  actions: ReaderActions;
  chapters: Chapter[];
  mobile: boolean;
}) {
  if (mobile) {
    return (
      <footer className="rd-footer rd-footer-m rd-chrome" onClick={(e) => e.stopPropagation()}>
        <PositionSlider engine={engine} chapters={chapters} mobile />
        <ReaderStats engine={engine} mobile />
        <Transport engine={engine} actions={actions} mobile />
        <SpeedControl engine={engine} actions={actions} mobile />
      </footer>
    );
  }
  return (
    <footer className="rd-footer rd-chrome">
      <PositionSlider engine={engine} chapters={chapters} mobile={false} />
      <div className="rd-footer-row">
        <ReaderStats engine={engine} mobile={false} />
        <Transport engine={engine} actions={actions} mobile={false} />
        <SpeedControl engine={engine} actions={actions} mobile={false} />
      </div>
    </footer>
  );
}

function FinishedCard({ title, onBack, onRestart }: { title: string; onBack: () => void; onRestart: () => void }) {
  return (
    <div className="rd-finished" onClick={(e) => e.stopPropagation()}>
      <span className="rd-finished-eyebrow">Finished</span>
      <h2>
        You’ve finished <em>{title}</em>
      </h2>
      <p>Read to the last word.</p>
      <div className="rd-finished-btns">
        <button type="button" className="rd-btn-secondary" onClick={onRestart}>
          Start again
        </button>
        <button type="button" className="rd-btn-primary" onClick={onBack}>
          Back to library
        </button>
      </div>
    </div>
  );
}
