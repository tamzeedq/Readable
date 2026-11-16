import { useEffect, useMemo, useState } from 'react';
import { Clipboard, Play, Plus, Search } from 'lucide-react';
import { bookPercent, bookStatus, useAppStore, useLibraryBooks } from '../store/appStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { loadBookContent } from '../lib/bookStorage';
import { formatHeaderDate, formatTimeLeft, greeting } from '../lib/format';
import { Cover } from '../components/ui/Cover';
import { ProgressBar } from '../components/ui/controls';
import type { Book } from '../types';
import { byRecent, chapterAt, statusLabel } from './library/bookUtils';
import { WelcomeCard } from './library/WelcomeCard';
import './HomeScreen.css';

const RING_R = 48;
const RING_C = 2 * Math.PI * RING_R;

/** ~8 words around the resume point, loaded from IndexedDB */
function useResumeSnippet(book: Book | undefined): string | null {
  const [snippet, setSnippet] = useState<string | null>(null);
  const id = book?.id;
  const at = book?.progressWordIndex ?? 0;
  useEffect(() => {
    setSnippet(null);
    if (!id) return;
    let cancelled = false;
    loadBookContent(id)
      .then((content) => {
        if (cancelled || !content?.words.length) return;
        const i = Math.max(0, Math.min(at, content.words.length - 1));
        const start = Math.max(0, i - 2);
        const words = content.words.slice(start, start + 7);
        if (!words.length) return;
        const text = words
          .join(' ')
          .replace(/^[\s"'“‘([—–-]+/, '')
          .replace(/[\s.,;:!?"'”’)\]—–-]+$/, '');
        if (text) setSnippet(text);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, at]);
  return snippet;
}

function ProgressRing({ percent }: { percent: number }) {
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * RING_C;
  return (
    <div className="home-ring" role="img" aria-label={`${percent} percent read`}>
      <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
        <circle cx="56" cy="56" r={RING_R} fill="none" stroke="var(--line-strong)" strokeWidth="5" />
        {dash > 0 && (
          <circle
            cx="56"
            cy="56"
            r={RING_R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${RING_C}`}
            transform="rotate(-90 56 56)"
          />
        )}
      </svg>
      <div className="home-ring-label">{percent}%</div>
    </div>
  );
}

function ContinueCard({ book, mobile }: { book: Book; mobile: boolean }) {
  const defaultWpm = useAppStore((s) => s.readingPrefs.defaultWpm);
  const openReader = useAppStore((s) => s.openReader);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const snippet = useResumeSnippet(book);

  const unread = bookStatus(book) === 'unread';
  const pct = bookPercent(book);
  const wpm = book.wpm ?? defaultWpm;
  const left = formatTimeLeft(Math.max(0, book.wordCount - book.progressWordIndex), wpm);
  const chapter = chapterAt(book, book.progressWordIndex);
  const eyebrow = unread ? 'Start reading' : 'Continue reading';
  const resumeLabel = unread ? 'Start reading' : 'Resume';

  const resumeLine = (
    <>
      {chapter && <>{chapter.title} · </>}
      {snippet ? (
        <>
          {unread ? 'begins' : 'resume at'} <span className="home-snippet">“…{snippet}…”</span>
        </>
      ) : unread ? (
        'Not started yet'
      ) : (
        `${pct}% through`
      )}
    </>
  );

  if (mobile) {
    return (
      <section className="home-m-card" aria-label={eyebrow}>
        <div className="home-m-card-top">
          <Cover book={book} width={92} titleSize={14} authorSize={7} />
          <div className="home-m-card-text">
            <div className="home-eyebrow">{eyebrow}</div>
            <h2 className="home-m-title">{book.title}</h2>
            {book.author && <div className="home-m-author">{book.author}</div>}
            {chapter && <div className="home-m-chapter">{chapter.title}</div>}
          </div>
        </div>
        <div className="home-m-progress">
          <div className="home-m-progress-row">
            <span>{pct}% read</span>
            <span className="italic-meta">
              {left} left · {wpm} wpm
            </span>
          </div>
          <ProgressBar percent={pct} height={4} />
        </div>
        <div className="home-m-actions">
          <button type="button" className="btn btn-primary home-m-btn" onClick={() => openReader(book.id)}>
            <Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            {resumeLabel}
          </button>
          <button type="button" className="btn home-m-btn" onClick={() => openOverlay('details', book.id)}>
            Details
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="home-hero" aria-label={eyebrow}>
      <Cover book={book} width={156} titleSize={23} authorSize={10} variant="hero" />
      <div className="home-hero-main">
        <div className="home-eyebrow">{eyebrow}</div>
        <h2 className="home-hero-title">{book.title}</h2>
        {book.author && <div className="home-hero-author">{book.author}</div>}
        <div className="home-hero-resume">{resumeLine}</div>
        <div className="home-hero-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => openReader(book.id)}>
            <Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            {resumeLabel}
          </button>
          <button type="button" className="btn btn-lg home-btn-secondary" onClick={() => openOverlay('details', book.id)}>
            Details
          </button>
        </div>
      </div>
      <div className="home-hero-side">
        <ProgressRing percent={pct} />
        <div className="home-hero-left">
          <div>{left} left</div>
          <div className="italic-meta home-hero-wpm">at {wpm} wpm</div>
        </div>
      </div>
    </section>
  );
}

function AllCaughtUp() {
  const openOverlay = useAppStore((s) => s.openOverlay);
  return (
    <section className="home-caught-up" aria-label="All caught up">
      <div>
        <div className="home-eyebrow">All caught up</div>
        <h2>You’ve read every book to the last word.</h2>
        <p className="italic-meta">Add something new, or paste an article to read it now.</p>
      </div>
      <div className="home-caught-up-actions">
        <button type="button" className="btn" onClick={() => openOverlay('paste')}>
          <Clipboard size={17} strokeWidth={1.6} aria-hidden="true" />
          Paste text
        </button>
        <button type="button" className="btn btn-primary" onClick={() => openOverlay('import')}>
          <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
          Add books
        </button>
      </div>
    </section>
  );
}

function RecentTile({ book, mobile }: { book: Book; mobile: boolean }) {
  const openReader = useAppStore((s) => s.openReader);
  const pct = bookPercent(book);
  const open = () => openReader(book.id);
  return (
    <div
      className="home-tile"
      role="button"
      tabIndex={0}
      title={`${bookStatus(book) === 'unread' ? 'Start' : 'Resume'} ${book.title}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      {/* Accessible name comes from the visible title + status (WCAG 2.5.3); the cover repeats the title */}
      <Cover book={book} titleSize={mobile ? 14 : 15} authorSize={mobile ? 7 : 8} decorative />
      <div className="home-tile-text">
        <div className="home-tile-title">{book.title}</div>
        <div className="home-tile-status">
          <ProgressBar percent={pct} />
          <span>{statusLabel(book, mobile)}</span>
        </div>
      </div>
    </div>
  );
}

export function HomeScreen() {
  const books = useLibraryBooks();
  const isMobile = useIsMobile();
  const openOverlay = useAppStore((s) => s.openOverlay);
  const openLibrary = useAppStore((s) => s.openLibrary);
  const now = new Date();

  const { hero, recent, anyRead } = useMemo(() => {
    const inProgress = books
      .filter((b) => bookStatus(b) === 'in-progress')
      .sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0));
    const unread = books.filter((b) => bookStatus(b) === 'unread').sort((a, b) => b.addedAt - a.addedAt);
    return {
      hero: inProgress[0] ?? unread[0],
      recent: [...books].sort(byRecent).slice(0, 6),
      anyRead: books.some((b) => b.lastReadAt),
    };
  }, [books]);

  const empty = books.length === 0;
  const recentTitle = anyRead ? 'Recently read' : 'Recently added';

  if (isMobile) {
    return (
      <div className="screen home-m">
        <header className="home-m-header">
          <div>
            <div className="home-date">{formatHeaderDate(now)}</div>
            <h1 className="home-m-greeting">{greeting(now)}</h1>
          </div>
          <button type="button" className="home-round-btn" aria-label="Search" onClick={() => openOverlay('search')}>
            <Search size={19} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </header>

        {empty ? (
          <WelcomeCard mobile />
        ) : (
          <>
            {hero ? <ContinueCard book={hero} mobile /> : <AllCaughtUp />}
            <div className="home-m-add">
              <button type="button" className="btn home-m-btn" onClick={() => openOverlay('import')}>
                <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
                Add books
              </button>
              <button type="button" className="btn home-m-btn" onClick={() => openOverlay('paste')}>
                <Clipboard size={17} strokeWidth={1.6} aria-hidden="true" />
                Paste text
              </button>
            </div>
            <section className="home-recent" aria-label={recentTitle}>
              <div className="home-recent-head">
                <h2>{recentTitle}</h2>
                <button type="button" className="home-link" onClick={() => openLibrary()}>
                  See all
                </button>
              </div>
              <div className="home-m-scroller">
                {recent.map((b) => (
                  <RecentTile key={b.id} book={b} mobile />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="screen home">
      <header className="home-header">
        <div>
          <div className="home-date">{formatHeaderDate(now)}</div>
          <h1 className="home-greeting">{greeting(now)}</h1>
        </div>
        <div className="home-header-actions">
          <button type="button" className="btn" onClick={() => openOverlay('paste')}>
            <Clipboard size={17} strokeWidth={1.6} aria-hidden="true" />
            Paste text
          </button>
          <button type="button" className="btn btn-primary" onClick={() => openOverlay('import')}>
            <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
            Add books
          </button>
        </div>
      </header>

      {empty ? (
        <WelcomeCard />
      ) : (
        <>
          {hero ? <ContinueCard book={hero} mobile={false} /> : <AllCaughtUp />}
          <section className="home-recent" aria-label={recentTitle}>
            <div className="home-recent-head">
              <h2>{recentTitle}</h2>
              <button type="button" className="home-link" onClick={() => openLibrary()}>
                View library
              </button>
            </div>
            <div className="home-grid">
              {recent.map((b) => (
                <RecentTile key={b.id} book={b} mobile={false} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
