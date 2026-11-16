import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3,
  CircleCheck,
  ClipboardPaste,
  Folder,
  Home,
  Library,
  Moon,
  Play,
  Plus,
  Search,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { bookPercent, bookStatus, useAppStore, useLibraryBooks } from '../store/appStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Modal } from '../components/ui/Overlay';
import { Spine } from '../components/ui/Cover';
import { useResolvedTheme } from '../screens/settings/shared';
import type { Book, Screen } from '../types';
import { searchBooks, splitMatch } from './search/searchModel';
import './search/Search.css';

interface ActionDef {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Extra words that match (not displayed) */
  keywords?: string;
  /** Shown when the query is empty */
  common?: boolean;
  run: () => void;
}

type Item =
  | { kind: 'book'; key: string; book: Book }
  | { kind: 'action'; key: string; action: ActionDef };

function Highlight({ text, query, className }: { text: string; query: string; className?: string }) {
  const parts = splitMatch(text, query);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <strong className={className}>{parts[1]}</strong>
      {parts[2]}
    </>
  );
}

function bookMeta(b: Book): { status: string; inProgress: boolean } {
  const st = bookStatus(b);
  if (st === 'finished') return { status: 'Finished', inProgress: false };
  if (st === 'unread') return { status: 'Unread', inProgress: false };
  return { status: `${bookPercent(b)}%`, inProgress: true };
}

const SCREEN_LABELS: { screen: Screen; label: string; icon: LucideIcon; keywords: string }[] = [
  { screen: 'home', label: 'Go to Home', icon: Home, keywords: 'start dashboard' },
  { screen: 'library', label: 'Go to Library', icon: Library, keywords: 'books all' },
  { screen: 'collections', label: 'Go to Collections', icon: Folder, keywords: 'shelves smart lists' },
  { screen: 'stats', label: 'Go to Stats', icon: BarChart3, keywords: 'statistics reading time streak' },
  { screen: 'settings', label: 'Go to Settings', icon: Settings, keywords: 'preferences options speed wpm' },
];

export function SearchOverlay() {
  const books = useLibraryBooks();
  const screen = useAppStore((s) => s.screen);
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const openReader = useAppStore((s) => s.openReader);
  const navigate = useAppStore((s) => s.navigate);
  const updateBook = useAppStore((s) => s.updateBook);
  const setTheme = useAppStore((s) => s.setTheme);
  const resolved = useResolvedTheme();
  const isMobile = useIsMobile();

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const optId = (i: number) => `${baseId}-opt-${i}`;
  const listId = `${baseId}-list`;

  const q = query.trim().toLowerCase();
  const bookResults = useMemo(() => searchBooks(books, query), [books, query]);

  const lastRead = useMemo(
    () =>
      books
        .filter((b) => bookStatus(b) === 'in-progress' && b.lastReadAt)
        .sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0))[0],
    [books],
  );

  const actionResults = useMemo(() => {
    const defs: ActionDef[] = [
      { key: 'add', label: 'Add books', icon: Plus, keywords: 'import epub pdf txt files open', common: true, run: () => openOverlay('import') },
      { key: 'paste', label: 'Paste text', icon: ClipboardPaste, keywords: 'clipboard new', common: true, run: () => openOverlay('paste') },
    ];
    if (lastRead) {
      defs.push({
        key: 'resume',
        label: `Resume ${lastRead.title}`,
        icon: Play,
        keywords: 'continue reading play',
        common: true,
        run: () => openReader(lastRead.id),
      });
    }
    for (const s of SCREEN_LABELS) {
      if (s.screen === screen) continue;
      defs.push({
        key: `go-${s.screen}`,
        label: s.label,
        icon: s.icon,
        keywords: s.keywords,
        common: s.screen === 'library',
        run: () => navigate(s.screen),
      });
    }
    defs.push({ key: 'shelves', label: 'Manage shelves', icon: Folder, keywords: 'collections new shelf', run: () => navigate('collections') });
    // "Mark … as finished" targets the top unfinished book match (or the last-read book)
    const target = q ? bookResults.find((b) => bookStatus(b) !== 'finished') : lastRead;
    if (target) {
      defs.push({
        key: 'finish',
        label: `Mark ${target.title} as finished`,
        icon: CircleCheck,
        keywords: 'done complete read',
        run: () => {
          updateBook(target.id, {
            finishedAt: Date.now(),
            progressWordIndex: Math.max(0, target.wordCount - 1),
          });
          closeOverlay();
        },
      });
    }
    const toDark = resolved === 'light';
    defs.push({
      key: 'theme',
      label: toDark ? 'Switch to dark theme' : 'Switch to light theme',
      icon: toDark ? Moon : Sun,
      keywords: 'appearance mode night day colour color',
      common: true,
      run: () => {
        setTheme(toDark ? 'dark' : 'light');
        closeOverlay();
      },
    });

    if (!q) return defs.filter((d) => d.common).slice(0, 5);
    const scored = defs
      .map((d) => {
        const label = d.label.toLowerCase();
        const s = label.startsWith(q)
          ? 0
          : label.split(/\s+/).some((w) => w.startsWith(q))
            ? 1
            : label.includes(q)
              ? 2
              : d.keywords?.toLowerCase().includes(q)
                ? 3
                : null;
        return { d, s };
      })
      .filter((x): x is { d: ActionDef; s: number } => x.s !== null);
    scored.sort((a, b) => a.s - b.s);
    return scored.slice(0, 6).map((x) => x.d);
  }, [q, bookResults, lastRead, screen, resolved, openOverlay, openReader, navigate, updateBook, setTheme, closeOverlay]);

  const items: Item[] = useMemo(
    () => [
      ...bookResults.map((b): Item => ({ kind: 'book', key: `b-${b.id}`, book: b })),
      ...actionResults.map((a): Item => ({ kind: 'action', key: `a-${a.key}`, action: a })),
    ],
    [bookResults, actionResults],
  );

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items.length, active]);

  useEffect(() => {
    const el = document.getElementById(optId(active));
    el?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const runItem = (it: Item) => {
    if (it.kind === 'action') {
      it.action.run();
      return;
    }
    if (bookMeta(it.book).inProgress) openReader(it.book.id);
    else openOverlay('details', it.book.id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === 'Home' && e.ctrlKey) {
      setActive(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[active];
      if (it) runItem(it);
    }
  };

  const renderBook = (b: Book, i: number) => {
    const meta = bookMeta(b);
    const isActive = i === active;
    const hint = meta.inProgress ? 'Resume' : 'Open';
    return (
      <div
        key={b.id}
        id={optId(i)}
        role="option"
        aria-selected={isActive}
        className={`so-book ${isActive ? 'active' : ''}`}
        onMouseMove={() => !isActive && setActive(i)}
        onClick={() => runItem(items[i])}
      >
        <Spine hue={b.coverHue} width={isMobile ? 32 : 28} height={isMobile ? 46 : 40} />
        <span className="so-book-text">
          <span className="so-book-title">
            <Highlight text={b.title} query={query} />
          </span>
          <span className="so-book-meta">
            {b.author && (
              <>
                <Highlight text={b.author} query={b.title.toLowerCase().includes(q) ? '' : query} className="so-meta-strong" />
                {' · '}
              </>
            )}
            {meta.status}
          </span>
        </span>
        {isMobile ? (
          meta.inProgress ? <span className="so-hint accent">Resume</span> : <span />
        ) : (
          <span className="so-hint">{isActive ? `↵ ${hint}` : ''}</span>
        )}
      </div>
    );
  };

  const renderAction = (a: ActionDef, i: number) => {
    const isActive = i === active;
    const Icon = a.icon;
    return (
      <div
        key={a.key}
        id={optId(i)}
        role="option"
        aria-selected={isActive}
        className={`so-action ${isActive ? 'active' : ''}`}
        onMouseMove={() => !isActive && setActive(i)}
        onClick={() => runItem(items[i])}
      >
        <Icon size={isMobile ? 19 : 18} strokeWidth={1.6} aria-hidden="true" className="so-action-icon" />
        <span className="so-action-label">
          <Highlight text={a.label} query={query} />
        </span>
        {!isMobile && <span className="so-hint">{isActive ? '↵ Open' : ''}</span>}
      </div>
    );
  };

  const group = (label: string, children: ReactNode, first: boolean) => {
    const hid = `${baseId}-${label}`;
    return (
      <div role="group" aria-labelledby={hid} className="so-group">
        <div id={hid} className={`so-group-label ${first ? 'first' : ''}`} role="presentation">
          {label}
        </div>
        {children}
      </div>
    );
  };

  const results: ReactNode = items.length ? (
    <>
      {bookResults.length > 0 &&
        group(q ? 'Books' : 'Recent books', bookResults.map((b, i) => renderBook(b, i)), true)}
      {actionResults.length > 0 &&
        group(
          'Actions',
          actionResults.map((a, j) => renderAction(a, bookResults.length + j)),
          bookResults.length === 0,
        )}
    </>
  ) : (
    <p className="so-empty">No books or actions match “{query.trim()}”. Check the spelling, or try an author or a word from the title.</p>
  );

  const input = (
    <input
      className="so-input"
      type="text"
      role="combobox"
      aria-expanded={items.length > 0}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={items.length ? optId(active) : undefined}
      aria-label="Search books and actions"
      placeholder={isMobile ? 'Search' : 'Search books and actions'}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={onKeyDown}
      autoFocus
      autoComplete="off"
      spellCheck={false}
    />
  );

  if (isMobile) {
    return (
      <Modal label="Search" onClose={closeOverlay} className="so-dialog so-mobile" scrimClass="so-scrim">
        <div className="so-m-bar">
          <label className="so-m-field">
            <Search size={18} strokeWidth={1.6} aria-hidden="true" />
            {input}
          </label>
          <button type="button" className="so-m-cancel" onClick={closeOverlay}>
            Cancel
          </button>
        </div>
        <div className="so-list" id={listId} role="listbox" aria-label="Results" ref={listRef}>
          {results}
        </div>
      </Modal>
    );
  }

  return (
    <Modal label="Search" onClose={closeOverlay} className="so-dialog" scrimClass="so-scrim">
      <div className="so-input-row">
        <Search size={20} strokeWidth={1.6} aria-hidden="true" className="so-input-icon" />
        {input}
        <kbd>Esc</kbd>
      </div>
      <div className="so-list" id={listId} role="listbox" aria-label="Results" ref={listRef}>
        {results}
      </div>
      <div className="so-footer" aria-hidden="true">
        <span>↑ ↓ to move</span>
        <span>↵ to open</span>
        <span>Esc to close</span>
      </div>
    </Modal>
  );
}
