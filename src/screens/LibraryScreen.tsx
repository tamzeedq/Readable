import { useMemo, useState } from 'react';
import {
  AlignJustify,
  ArrowDownWideNarrow,
  ChevronDown,
  LayoutGrid,
  List,
  Play,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  bookPercent,
  defaultLibraryFilter,
  useAppStore,
  useLibraryBooks,
} from '../store/appStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Cover } from '../components/ui/Cover';
import { ProgressBar, Segmented } from '../components/ui/controls';
import type { Book, BookFormat, StatusFilter } from '../types';
import {
  FORMAT_LABEL,
  SORT_LABEL,
  filterBooks,
  hasActiveFilters,
  lastReadLabel,
  plural,
  sortBooks,
  statusLabel,
  type SortKey,
} from './library/bookUtils';
import { MenuItem, Popover, usePopover } from './library/Popover';
import { BookActions } from './library/BookActions';
import { WelcomeCard } from './library/WelcomeCard';
import './LibraryScreen.css';

type ViewMode = 'grid' | 'list' | 'compact';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'finished', label: 'Finished' },
];

const FORMATS: BookFormat[] = ['epub', 'pdf', 'txt', 'paste'];

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- Dropdowns

interface DropdownOption<T> {
  value: T;
  label: string;
  swatch?: string;
}

function FilterDropdown<T extends string>({
  label,
  anyLabel,
  value,
  options,
  onChange,
  emptyText,
  pill,
}: {
  label: string;
  anyLabel: string;
  value: T | null;
  options: DropdownOption<T>[];
  onChange: (v: T | null) => void;
  emptyText?: string;
  /** Mobile chip styling */
  pill?: boolean;
}) {
  const pop = usePopover();
  const current = options.find((o) => o.value === value);
  return (
    <>
      <button
        type="button"
        ref={pop.anchorRef}
        className={`${pill ? 'lib-m-chip' : 'lib-dropdown'} ${current ? 'is-set' : ''}`}
        aria-haspopup="menu"
        aria-expanded={pop.open}
        aria-label={current ? `${label}: ${current.label}` : label}
        onClick={pop.toggle}
      >
        {current?.swatch && <span className="bk-shelf-tab" style={{ background: current.swatch }} aria-hidden="true" />}
        <span className="lib-dropdown-text">{current ? current.label : label}</span>
        <ChevronDown size={pill ? 13 : 14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {pop.open && (
        <Popover anchorRef={pop.anchorRef} onClose={pop.close} label={label}>
          <MenuItem
            checked={value === null}
            onSelect={() => {
              onChange(null);
              pop.close();
            }}
          >
            {anyLabel}
          </MenuItem>
          {options.length === 0 && emptyText && <div className="bk-menu-empty">{emptyText}</div>}
          {options.map((o) => (
            <MenuItem
              key={o.value}
              checked={o.value === value}
              onSelect={() => {
                onChange(o.value);
                pop.close();
              }}
            >
              {o.swatch && <span className="bk-shelf-tab" style={{ background: o.swatch }} aria-hidden="true" />}
              {o.label}
            </MenuItem>
          ))}
        </Popover>
      )}
    </>
  );
}

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const pop = usePopover();
  return (
    <>
      <button
        type="button"
        ref={pop.anchorRef}
        className="lib-sort"
        aria-haspopup="menu"
        aria-expanded={pop.open}
        aria-label={`Sort by ${SORT_LABEL[value]}`}
        onClick={pop.toggle}
      >
        <ArrowDownWideNarrow size={16} strokeWidth={1.6} aria-hidden="true" />
        {SORT_LABEL[value]}
      </button>
      {pop.open && (
        <Popover anchorRef={pop.anchorRef} onClose={pop.close} label="Sort by" align="end" minWidth={170}>
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <MenuItem
              key={k}
              checked={k === value}
              onSelect={() => {
                onChange(k);
                pop.close();
              }}
            >
              {SORT_LABEL[k]}
            </MenuItem>
          ))}
        </Popover>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Book views

function openOnKey(onOpen: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };
}

function BookTile({ book }: { book: Book }) {
  const openReader = useAppStore((s) => s.openReader);
  const [busy, setBusy] = useState(false);
  const open = () => openReader(book.id);
  const onKey = openOnKey(open);
  const pct = bookPercent(book);
  return (
    <div
      className={`lib-tile ${busy ? 'is-active' : ''}`}
      tabIndex={0}
      role="group"
      aria-label={`${book.title}${book.author ? ` by ${book.author}` : ''} — press Enter to read`}
      onKeyDown={onKey}
    >
      <div className="lib-tile-cover">
        <Cover book={book} />
        <div className="lib-tile-overlay" onClick={open}>
          <button
            type="button"
            className="lib-ov-read"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            <Play size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            Read
          </button>
          <div className="lib-ov-icons">
            <BookActions book={book} variant="overlay" onBusyChange={setBusy} />
          </div>
        </div>
      </div>
      <div className="lib-tile-text" onClick={open}>
        <div className="lib-tile-title" title={book.title}>
          {book.title}
        </div>
        <div className="lib-tile-author">{book.author || 'Unknown author'}</div>
        <div className="lib-tile-progress">
          <ProgressBar percent={pct} />
          <span>{statusLabel(book)}</span>
        </div>
        <div className="lib-tile-meta">
          <span className="badge">{FORMAT_LABEL[book.format]}</span>
          <span>{lastReadLabel(book)}</span>
        </div>
      </div>
    </div>
  );
}

function BookRow({ book, compact }: { book: Book; compact: boolean }) {
  const openReader = useAppStore((s) => s.openReader);
  const [busy, setBusy] = useState(false);
  const open = () => openReader(book.id);
  const onKey = openOnKey(open);
  const pct = bookPercent(book);
  return (
    <div
      className={`lib-row ${compact ? 'is-compact' : ''} ${busy ? 'is-active' : ''}`}
      role="row"
      tabIndex={0}
      aria-label={`${book.title} — press Enter to read`}
      onKeyDown={onKey}
      onClick={open}
    >
      {!compact && (
        <div role="cell" className="lib-row-cover">
          <Cover book={book} width={40} titleSize={6} authorSize={4} />
        </div>
      )}
      <div role="cell" className="lib-row-main">
        <span className="lib-row-title">{book.title}</span>
        <span className="lib-row-author">{book.author || 'Unknown author'}</span>
      </div>
      <div role="cell" className="lib-row-format">
        <span className="badge">{FORMAT_LABEL[book.format]}</span>
      </div>
      <div role="cell" className="lib-row-progress">
        {!compact && <ProgressBar percent={pct} />}
        <span className="tabular">{statusLabel(book)}</span>
      </div>
      <div role="cell" className="lib-row-last">
        {lastReadLabel(book)}
      </div>
      <div role="cell" className="lib-row-actions">
        <BookActions book={book} variant="row" onBusyChange={setBusy} />
      </div>
    </div>
  );
}

function MobileTile({ book }: { book: Book }) {
  const openOverlay = useAppStore((s) => s.openOverlay);
  const open = () => openOverlay('details', book.id);
  return (
    <div
      className="lib-m-tile"
      role="button"
      tabIndex={0}
      aria-label={`${book.title} — details`}
      onClick={open}
      onKeyDown={openOnKey(open)}
    >
      <Cover book={book} titleSize={14} authorSize={7} />
      <div className="lib-m-tile-title">{book.title}</div>
      <div className="lib-m-tile-progress">
        <ProgressBar percent={bookPercent(book)} />
        <span>{statusLabel(book, true)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Screen

export function LibraryScreen() {
  const allBooks = useLibraryBooks();
  const shelves = useAppStore((s) => s.shelves);
  const filter = useAppStore((s) => s.libraryFilter);
  const setFilter = useAppStore((s) => s.setLibraryFilter);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const isMobile = useIsMobile();

  const [sort, setSortState] = useState<SortKey>(() =>
    readPref<SortKey>('readable.library.sort', ['recent', 'title', 'author', 'progress', 'added'], 'recent'),
  );
  const [view, setViewState] = useState<ViewMode>(() =>
    readPref<ViewMode>('readable.library.view', ['grid', 'list', 'compact'], 'grid'),
  );
  const setSort = (v: SortKey) => {
    setSortState(v);
    writePref('readable.library.sort', v);
  };
  const setView = (v: ViewMode) => {
    setViewState(v);
    writePref('readable.library.view', v);
  };

  const results = useMemo(() => sortBooks(filterBooks(allBooks, filter), sort), [allBooks, filter, sort]);

  const allTags = useMemo(
    () => Array.from(new Set(allBooks.flatMap((b) => b.tags))).sort((a, b) => a.localeCompare(b)),
    [allBooks],
  );
  const formatsPresent = useMemo(() => FORMATS.filter((f) => allBooks.some((b) => b.format === f)), [allBooks]);
  const activeShelf = shelves.find((s) => s.id === filter.shelfId);

  // "Fiction · 6 books" / "Recently added · 3 books" / "10 books"
  const context = [activeShelf?.name, filter.recent ? 'Recently added' : null].filter(Boolean).join(' · ');
  const countText = plural(results.length, 'book');
  const meta = context ? `${context} · ${countText}` : countText;

  const filtered = hasActiveFilters(filter);
  const clearFilters = () => setFilter(defaultLibraryFilter);
  const empty = allBooks.length === 0;

  const formatOptions = (formatsPresent.length ? formatsPresent : FORMATS).map((f) => ({
    value: f,
    label: f === 'paste' ? 'Pasted text' : FORMAT_LABEL[f],
  }));
  const shelfOptions = shelves.map((s) => ({ value: s.id, label: s.name, swatch: s.color }));
  const tagOptions = allTags.map((t) => ({ value: t, label: t }));

  const noResults = (
    <div className="bk-empty">
      <h2>No books match</h2>
      <p>Nothing in your library matches. Try different words, or loosen the filters to see everything again.</p>
      <button type="button" className="btn" onClick={clearFilters}>
        Clear filters
      </button>
    </div>
  );

  // ------------------------------------------------------------ Mobile
  if (isMobile) {
    return (
      <div className="screen lib-m">
        <header className="lib-m-header">
          <div className="lib-m-title">
            <h1>Library</h1>
            <span aria-live="polite">{meta}</span>
          </div>
          <div className="lib-m-header-actions">
            <button type="button" className="lib-round" aria-label="Search" onClick={() => openOverlay('search')}>
              <Search size={19} strokeWidth={1.6} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lib-round is-primary"
              aria-label="Add books"
              onClick={() => openOverlay('import')}
            >
              <Plus size={19} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </header>

        {empty ? (
          <WelcomeCard mobile eyebrow="Your library" title="Nothing on the shelves yet" />
        ) : (
          <>
            <div className="lib-m-chips">
              <div role="radiogroup" aria-label="Status" className="lib-m-chip-group">
                {STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={filter.status === o.value}
                    className="lib-m-chip"
                    onClick={() => setFilter({ status: o.value })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <FilterDropdown
                pill
                label="Shelf"
                anyLabel="Any shelf"
                value={filter.shelfId}
                options={shelfOptions}
                onChange={(v) => setFilter({ shelfId: v })}
                emptyText="No shelves yet"
              />
              {filter.recent && (
                <button type="button" className="lib-m-chip is-set" onClick={() => setFilter({ recent: false })}>
                  Recently added <X size={13} strokeWidth={2} aria-label="Remove filter" />
                </button>
              )}
              {filter.format && (
                <button type="button" className="lib-m-chip is-set" onClick={() => setFilter({ format: null })}>
                  {FORMAT_LABEL[filter.format]} <X size={13} strokeWidth={2} aria-label="Remove filter" />
                </button>
              )}
              {filter.tag && (
                <button type="button" className="lib-m-chip is-set" onClick={() => setFilter({ tag: null })}>
                  <i>{filter.tag}</i> <X size={13} strokeWidth={2} aria-label="Remove filter" />
                </button>
              )}
              {filter.query.trim() && (
                <button type="button" className="lib-m-chip is-set" onClick={() => setFilter({ query: '' })}>
                  “{filter.query.trim()}” <X size={13} strokeWidth={2} aria-label="Clear search" />
                </button>
              )}
            </div>
            {results.length === 0 ? (
              noResults
            ) : (
              <div className="lib-m-grid">
                {results.map((b) => (
                  <MobileTile key={b.id} book={b} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------ Desktop
  return (
    <div className="screen lib">
      <header className="lib-header">
        <div className="page-title">
          <h1>Library</h1>
          <span className="meta" aria-live="polite">
            {meta}
          </span>
        </div>
        <div className="lib-header-actions">
          <label className="lib-search">
            <Search size={17} strokeWidth={1.6} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search title, author, tag"
              aria-label="Search title, author, tag"
              value={filter.query}
              onChange={(e) => setFilter({ query: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && filter.query) {
                  e.stopPropagation();
                  setFilter({ query: '' });
                }
              }}
            />
            {filter.query && (
              <button type="button" className="lib-search-clear" aria-label="Clear search" onClick={() => setFilter({ query: '' })}>
                <X size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            )}
          </label>
          <button type="button" className="btn btn-primary" onClick={() => openOverlay('import')}>
            <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
            Add books
          </button>
        </div>
      </header>

      {empty ? (
        <WelcomeCard eyebrow="Your library" title="Nothing on the shelves yet" />
      ) : (
        <>
          <div className="lib-filters">
            <div className="lib-filters-left">
              <Segmented
                label="Status"
                value={filter.status}
                options={STATUS_OPTIONS}
                onChange={(v) => setFilter({ status: v })}
              />
              <FilterDropdown
                label="Format"
                anyLabel="Any format"
                value={filter.format}
                options={formatOptions}
                onChange={(v) => setFilter({ format: v })}
              />
              <FilterDropdown
                label="Shelf"
                anyLabel="Any shelf"
                value={filter.shelfId}
                options={shelfOptions}
                onChange={(v) => setFilter({ shelfId: v })}
                emptyText="No shelves yet"
              />
              <FilterDropdown
                label="Tag"
                anyLabel="Any tag"
                value={filter.tag}
                options={tagOptions}
                onChange={(v) => setFilter({ tag: v })}
                emptyText="No tags yet — add them from a book’s details"
              />
              {filter.recent && (
                <span className="chip lib-filter-chip">
                  Recently added
                  <button type="button" aria-label="Remove Recently added filter" onClick={() => setFilter({ recent: false })}>
                    <X size={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                </span>
              )}
              {filtered && (
                <button type="button" className="btn btn-text lib-clear" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>
            <div className="lib-filters-right">
              <SortDropdown value={sort} onChange={setSort} />
              <Segmented
                label="View"
                className="lib-view"
                value={view}
                itemWidth={34}
                onChange={setView}
                options={[
                  { value: 'grid', label: <LayoutGrid size={16} strokeWidth={1.6} aria-hidden="true" />, ariaLabel: 'Grid view' },
                  { value: 'list', label: <List size={16} strokeWidth={1.6} aria-hidden="true" />, ariaLabel: 'List view' },
                  {
                    value: 'compact',
                    label: <AlignJustify size={16} strokeWidth={1.6} aria-hidden="true" />,
                    ariaLabel: 'Compact view',
                  },
                ]}
              />
            </div>
          </div>

          {results.length === 0 ? (
            noResults
          ) : view === 'grid' ? (
            <div className="lib-grid">
              {results.map((b) => (
                <BookTile key={b.id} book={b} />
              ))}
            </div>
          ) : (
            <div className={`lib-table ${view === 'compact' ? 'is-compact' : ''}`} role="table" aria-label="Books">
              <div className="lib-row lib-row-head" role="row">
                {view === 'list' && <span role="columnheader"><span className="sr-only">Cover</span></span>}
                <span role="columnheader">Title</span>
                <span role="columnheader">Format</span>
                <span role="columnheader">Progress</span>
                <span role="columnheader">Last read</span>
                <span role="columnheader"><span className="sr-only">Actions</span></span>
              </div>
              {results.map((b) => (
                <BookRow key={b.id} book={b} compact={view === 'compact'} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
