import { useMemo, useRef, useState } from 'react';
import { ChevronRight, CircleCheck, CirclePlay, Clock, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react';
import { bookStatus, isRecentlyAdded, useAppStore, useLibraryBooks } from '../store/appStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { formatRelativeDay } from '../lib/format';
import type { Book, LibraryFilter, Shelf } from '../types';
import { byRecent, plural, spineSize } from './library/bookUtils';
import { MenuItem, Popover, usePopover } from './library/Popover';
import { ConfirmDialog } from './library/ConfirmDialog';
import './CollectionsScreen.css';

function shelfNote(books: Book[]): string {
  if (!books.length) return 'Empty shelf — add books from the library';
  const inProgress = books.filter((b) => bookStatus(b) === 'in-progress').length;
  const finished = books.filter((b) => bookStatus(b) === 'finished').length;
  const lastRead = Math.max(0, ...books.map((b) => b.lastReadAt ?? 0));
  if (!lastRead) return 'Nothing started yet';
  const rel = formatRelativeDay(lastRead);
  const when = rel === 'Today' || rel === 'Yesterday' ? rel.toLowerCase() : rel;
  if (inProgress) return `${inProgress} in progress · last read ${when}`;
  if (finished === books.length) return `All finished · last read ${when}`;
  return `${finished} finished · last read ${when}`;
}

function SpineShelf({ books, color, mobile }: { books: Book[]; color: string; mobile: boolean }) {
  const shown = books.slice(0, mobile ? 12 : 10);
  return (
    <div className="col-shelf" style={{ borderBottomColor: color }} aria-hidden="true">
      {shown.length === 0
        ? [0, 1, 2].map((i) => {
            const h = mobile ? [86, 98, 80][i] : [118, 134, 110][i];
            return <div key={i} className="col-spine is-ghost" style={{ width: mobile ? 24 : 28, height: h }} />;
          })
        : shown.map((b) => {
            const { w, h } = spineSize(b.id, mobile);
            return (
              <div
                key={b.id}
                className="col-spine"
                style={{ width: w, height: h, background: `oklch(var(--cover-l) 0.07 ${b.coverHue})` }}
              >
                <span>{b.title}</span>
              </div>
            );
          })}
    </div>
  );
}

function ShelfCard({ shelf, books, mobile }: { shelf: Shelf; books: Book[]; mobile: boolean }) {
  const openLibrary = useAppStore((s) => s.openLibrary);
  const updateShelf = useAppStore((s) => s.updateShelf);
  const removeShelf = useAppStore((s) => s.removeShelf);
  const menu = usePopover();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(shelf.name);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => {
    if (!renaming) openLibrary({ shelfId: shelf.id });
  };
  const commit = () => {
    const n = name.trim();
    if (n && n !== shelf.name) updateShelf(shelf.id, { name: n });
    else setName(shelf.name);
    setRenaming(false);
  };

  return (
    <div
      className={`col-card ${mobile ? 'is-mobile' : ''}`}
      role="link"
      tabIndex={0}
      aria-label={`${shelf.name}, ${plural(books.length, 'book')}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === 'Enter') open();
      }}
    >
      <SpineShelf books={books} color={shelf.color} mobile={mobile} />
      <div className="col-card-text">
        <div className="col-card-head">
          {renaming ? (
            <input
              ref={inputRef}
              className="col-rename"
              value={name}
              autoFocus
              aria-label="Shelf name"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setName(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                  setName(shelf.name);
                  setRenaming(false);
                }
              }}
            />
          ) : (
            <h2>{shelf.name}</h2>
          )}
          <span className="col-card-count">{plural(books.length, 'book')}</span>
          <button
            type="button"
            ref={menu.anchorRef}
            className="icon-btn col-card-menu"
            aria-label={`${shelf.name} options`}
            aria-haspopup="menu"
            aria-expanded={menu.open}
            onClick={(e) => {
              e.stopPropagation();
              menu.toggle();
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Ellipsis size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
        <div className="col-card-note">{shelfNote(books)}</div>
      </div>
      {menu.open && (
        <Popover anchorRef={menu.anchorRef} onClose={menu.close} label={`${shelf.name} options`} align="end" minWidth={180}>
          <MenuItem
            icon={<Pencil size={15} strokeWidth={1.6} />}
            onSelect={() => {
              menu.close();
              setName(shelf.name);
              setRenaming(true);
            }}
          >
            Rename
          </MenuItem>
          <MenuItem
            danger
            icon={<Trash2 size={15} strokeWidth={1.6} />}
            onSelect={() => {
              menu.close();
              setConfirming(true);
            }}
          >
            Delete shelf…
          </MenuItem>
        </Popover>
      )}
      {confirming && (
        <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title={`Delete “${shelf.name}”?`}
            confirmLabel="Delete shelf"
            onConfirm={() => removeShelf(shelf.id)}
            onClose={() => setConfirming(false)}
          >
            The shelf is removed, but its {plural(books.length, 'book')} stay in your library.
          </ConfirmDialog>
        </div>
      )}
    </div>
  );
}

interface SmartList {
  key: string;
  name: string;
  note: string;
  icon: React.ReactNode;
  count: number;
  filter: Partial<LibraryFilter>;
}

export function CollectionsScreen({ onNewShelf }: { onNewShelf: () => void }) {
  const books = useLibraryBooks();
  const shelves = useAppStore((s) => s.shelves);
  const openLibrary = useAppStore((s) => s.openLibrary);
  const isMobile = useIsMobile();

  const byShelf = useMemo(() => {
    const map = new Map<string, Book[]>();
    for (const sh of shelves) map.set(sh.id, []);
    for (const b of [...books].sort(byRecent)) for (const id of b.shelves) map.get(id)?.push(b);
    return map;
  }, [books, shelves]);

  const smart: SmartList[] = useMemo(() => {
    const now = Date.now();
    const icon = (I: typeof Clock) => <I size={19} strokeWidth={1.6} aria-hidden="true" />;
    return [
      {
        key: 'recent',
        name: 'Recently added',
        note: 'Added in the last 14 days',
        icon: icon(Clock),
        count: books.filter((b) => isRecentlyAdded(b, now)).length,
        filter: { recent: true },
      },
      {
        key: 'in-progress',
        name: 'In progress',
        note: 'Started and not finished',
        icon: icon(CirclePlay),
        count: books.filter((b) => bookStatus(b) === 'in-progress').length,
        filter: { status: 'in-progress' },
      },
      {
        key: 'finished',
        name: 'Finished',
        note: 'Read to the last word',
        icon: icon(CircleCheck),
        count: books.filter((b) => bookStatus(b) === 'finished').length,
        filter: { status: 'finished' },
      },
    ];
  }, [books]);

  const meta = `${plural(shelves.length, 'shelf', 'shelves')} · ${smart.length} smart lists`;

  const shelvesSection = (
    <section aria-label="Shelves" className={isMobile ? 'col-m-shelves' : 'col-shelves'}>
      {shelves.map((sh) => (
        <ShelfCard key={sh.id} shelf={sh} books={byShelf.get(sh.id) ?? []} mobile={isMobile} />
      ))}
      {shelves.length === 0 && (
        <div className="bk-empty col-empty">
          <h2>No shelves yet</h2>
          <p>Shelves group books however you like — by mood, project or reading club.</p>
          <button type="button" className="btn" onClick={onNewShelf}>
            <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
            New shelf
          </button>
        </div>
      )}
    </section>
  );

  if (isMobile) {
    return (
      <div className="screen col-m">
        <header className="col-m-header">
          <h1>Collections</h1>
          <button type="button" className="col-round" aria-label="New shelf" onClick={onNewShelf}>
            <Plus size={19} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>
        {shelvesSection}
        <section aria-label="Smart lists" className="col-m-smart">
          <h2>Smart lists</h2>
          <div className="col-m-smart-card">
            {smart.map((m) => (
              <button key={m.key} type="button" className="col-m-smart-row" onClick={() => openLibrary(m.filter)}>
                <span className="col-m-smart-text">
                  <span className="col-m-smart-name">{m.name}</span>
                  <span className="col-m-smart-note">{m.note}</span>
                </span>
                <span className="col-count">{m.count}</span>
                <ChevronRight size={16} strokeWidth={1.6} className="col-chevron" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="screen col">
      <header className="col-header">
        <div className="page-title">
          <h1>Collections</h1>
          <span className="meta">{meta}</span>
        </div>
        <button type="button" className="btn" onClick={onNewShelf}>
          <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
          New shelf
        </button>
      </header>
      {shelvesSection}
      <section aria-label="Smart lists" className="col-smart">
        <div className="col-smart-head">
          <h2>Smart lists</h2>
          <span>Update automatically</span>
        </div>
        <div className="col-smart-table">
          {smart.map((m) => (
            <button key={m.key} type="button" className="col-smart-row" onClick={() => openLibrary(m.filter)}>
              {m.icon}
              <span className="col-smart-text">
                <span className="col-smart-name">{m.name}</span>
                <span className="col-smart-note">{m.note}</span>
              </span>
              <span className="col-count">{m.count}</span>
              <ChevronRight size={16} strokeWidth={1.6} className="col-chevron" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
