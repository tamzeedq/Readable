import { useEffect, useRef, useState } from 'react';
import { Bookmark, Play, Plus, X } from 'lucide-react';
import { bookPercent, bookStatus, useAppStore, useBook } from '../store/appStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { deleteCover, saveCover } from '../lib/bookStorage';
import { formatBytes, formatDateTime, formatLongDate, formatMinutes, formatNumber, formatTimeLeft } from '../lib/format';
import { Drawer, Sheet } from '../components/ui/Overlay';
import { Cover } from '../components/ui/Cover';
import { ProgressBar } from '../components/ui/controls';
import type { Book } from '../types';
import { FORMAT_LABEL, chapterAt, chapterIndexAt, plural } from '../screens/library/bookUtils';
import { MenuDivider, MenuItem, MenuLabel, Popover, usePopover } from '../screens/library/Popover';
import { ConfirmRemoveBook } from '../screens/library/ConfirmDialog';
import './BookDetails.css';

/** Text field that commits on blur / Enter and resyncs when the book changes elsewhere */
function EditableField({
  label,
  value,
  onCommit,
  className,
  required,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  required?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim();
    if (required && !v) {
      setDraft(value);
      return;
    }
    if (v !== value) onCommit(v);
  };
  return (
    <label className="bd-field">
      {label}
      <input
        className={`bd-input ${className ?? ''}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape' && draft !== value) {
            e.stopPropagation();
            setDraft(value);
          }
        }}
      />
    </label>
  );
}

function CoverEditor({ book, mobile }: { book: Book; mobile: boolean }) {
  const updateBook = useAppStore((s) => s.updateBook);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setBusy(true);
    try {
      await saveCover(book.id, file);
      updateBook(book.id, { hasCover: true });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    await deleteCover(book.id);
    updateBook(book.id, { hasCover: false });
  };

  return (
    <div className="bd-cover-col">
      <Cover book={book} width={mobile ? 84 : 100} titleSize={mobile ? 13 : 15} authorSize={mobile ? 6 : 7} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" className="bd-link" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? 'Saving…' : 'Change cover'}
      </button>
      {book.hasCover && (
        <button type="button" className="bd-link" onClick={remove}>
          Remove cover
        </button>
      )}
    </div>
  );
}

function ShelvesAndTags({ book, mobile }: { book: Book; mobile: boolean }) {
  const shelves = useAppStore((s) => s.shelves);
  const toggleBookShelf = useAppStore((s) => s.toggleBookShelf);
  const updateBook = useAppStore((s) => s.updateBook);
  const add = usePopover();
  const [tag, setTag] = useState('');

  const bookShelves = shelves.filter((s) => book.shelves.includes(s.id));
  const addTag = () => {
    const t = tag.trim().replace(/\s+/g, ' ');
    if (!t) return;
    if (!book.tags.some((x) => x.toLowerCase() === t.toLowerCase())) updateBook(book.id, { tags: [...book.tags, t] });
    setTag('');
  };

  return (
    <div className="bd-section">
      <span className="bd-label">Shelves &amp; tags</span>
      <div className={`bd-chips ${mobile ? 'is-mobile' : ''}`}>
        {bookShelves.map((s) => (
          <span key={s.id} className="bd-chip-shelf">
            <span className="bk-shelf-tab bd-tab" style={{ background: s.color }} aria-hidden="true" />
            {s.name}
            <button type="button" aria-label={`Remove from ${s.name}`} onClick={() => toggleBookShelf(book.id, s.id)}>
              <X size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          </span>
        ))}
        {book.tags.map((t) => (
          <span key={t} className="bd-chip-tag">
            {t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={() => updateBook(book.id, { tags: book.tags.filter((x) => x !== t) })}
            >
              <X size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          </span>
        ))}
        <button
          type="button"
          ref={add.anchorRef}
          className="bd-chip-add"
          aria-haspopup="menu"
          aria-expanded={add.open}
          onClick={add.toggle}
        >
          <Plus size={13} strokeWidth={2} aria-hidden="true" />
          Add
        </button>
      </div>
      {add.open && (
        <Popover anchorRef={add.anchorRef} onClose={add.close} label="Add shelf or tag" minWidth={230}>
          <MenuLabel>Shelves</MenuLabel>
          {shelves.length === 0 && <div className="bk-menu-empty">No shelves yet</div>}
          {shelves.map((s) => (
            <MenuItem key={s.id} checked={book.shelves.includes(s.id)} onSelect={() => toggleBookShelf(book.id, s.id)}>
              <span className="bk-shelf-tab" style={{ background: s.color }} aria-hidden="true" />
              {s.name}
            </MenuItem>
          ))}
          <MenuDivider />
          <MenuLabel>New tag</MenuLabel>
          <input
            className="bk-menu-input"
            placeholder="Type a tag, press Enter"
            aria-label="New tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
          />
        </Popover>
      )}
    </div>
  );
}

function Contents({ book, wpm, mobile }: { book: Book; wpm: number; mobile: boolean }) {
  const openReader = useAppStore((s) => s.openReader);
  const currentRef = useRef<HTMLButtonElement>(null);
  const status = bookStatus(book);
  const at = book.progressWordIndex;
  const currentIdx = status === 'in-progress' ? chapterIndexAt(book.chapters, at) : -1;

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
    // Only on open
  }, []);

  if (book.chapters.length < 2) return null;

  return (
    <div className="bd-section bd-contents">
      <span className="bd-label">Contents</span>
      <div className={`bd-toc ${mobile ? 'is-mobile' : ''}`}>
        {book.chapters.map((ch, i) => {
          const end = book.chapters[i + 1]?.startWord ?? book.wordCount;
          const len = Math.max(0, end - ch.startWord);
          const read = status === 'finished' || (status === 'in-progress' && i < currentIdx);
          const current = i === currentIdx;
          let right: string;
          if (read) right = 'Read';
          else if (current) right = `Reading · ${Math.min(99, Math.floor(((at - ch.startWord) / Math.max(1, len)) * 100))}%`;
          else right = formatMinutes(Math.max(1, len / wpm)).replace(/^(\d+) m$/, '$1 min');
          return (
            <button
              key={`${i}-${ch.startWord}`}
              ref={current ? currentRef : undefined}
              type="button"
              className={`bd-toc-row ${read ? 'is-read' : ''} ${current ? 'is-current' : ''}`}
              aria-current={current ? 'true' : undefined}
              onClick={() => openReader(book.id, ch.startWord)}
            >
              <span className="bd-toc-title">{ch.title || `Chapter ${i + 1}`}</span>
              <span className="bd-toc-meta">{right}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bookmarks({ book }: { book: Book }) {
  const openReader = useAppStore((s) => s.openReader);
  if (!book.bookmarks.length) return null;
  return (
    <div className="bd-section">
      <span className="bd-label">Bookmarks</span>
      <div className="bd-toc">
        {book.bookmarks.map((w) => {
          const ch = chapterAt(book, w);
          return (
            <button key={w} type="button" className="bd-toc-row" onClick={() => openReader(book.id, w)}>
              <span className="bd-toc-title bd-bookmark">
                <Bookmark size={14} strokeWidth={1.6} aria-hidden="true" />
                Word {formatNumber(w + 1)}
                {ch && <span className="bd-bookmark-ch"> · {ch.title}</span>}
              </span>
              <span className="bd-toc-meta">{Math.floor((w / Math.max(1, book.wordCount)) * 100)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailsBody({ book, mobile }: { book: Book; mobile: boolean }) {
  const updateBook = useAppStore((s) => s.updateBook);
  const defaultWpm = useAppStore((s) => s.readingPrefs.defaultWpm);
  const [editing, setEditing] = useState(!mobile);
  const wpm = book.wpm ?? defaultWpm;
  const pct = bookPercent(book);
  const left = formatTimeLeft(Math.max(0, book.wordCount - book.progressWordIndex), wpm);
  const status = bookStatus(book);
  const formatText =
    book.format === 'paste'
      ? `Pasted text · ${formatBytes(book.sizeBytes)}`
      : `${FORMAT_LABEL[book.format]} · ${formatBytes(book.sizeBytes)}`;

  const fields = (
    <div className="bd-fields">
      <EditableField
        label="Title"
        value={book.title}
        required
        className="bd-input-title"
        onCommit={(title) => updateBook(book.id, { title })}
      />
      <EditableField label="Author" value={book.author} onCommit={(author) => updateBook(book.id, { author })} />
    </div>
  );

  const progress = (
    <div className="bd-progress">
      <div className="bd-progress-row">
        <span>{status === 'finished' ? 'Finished' : `${pct}% read`}</span>
        <span className="italic-meta">
          {status === 'finished'
            ? book.finishedAt
              ? formatLongDate(book.finishedAt)
              : ''
            : mobile
              ? `${left} left`
              : `${left} left at ${wpm} wpm`}
        </span>
      </div>
      <ProgressBar percent={pct} height={4} />
    </div>
  );

  const facts = (
    <dl className="bd-dl">
      <dt>Format</dt>
      <dd>{formatText}</dd>
      <dt>Length</dt>
      <dd>
        {plural(book.wordCount, 'word')}
        {book.chapters.length > 0 && ` · ${plural(book.chapters.length, 'chapter')}`}
      </dd>
      <dt>Added</dt>
      <dd>{formatLongDate(book.addedAt)}</dd>
      <dt>Last read</dt>
      <dd>{book.lastReadAt ? formatDateTime(book.lastReadAt) : 'Not started'}</dd>
    </dl>
  );

  if (mobile) {
    return (
      <>
        <div className="bd-m-top">
          <Cover book={book} width={84} titleSize={13} authorSize={6} />
          <div className="bd-m-top-text">
            <h2>{book.title}</h2>
            {book.author && <div className="bd-m-author">{book.author}</div>}
            <button type="button" className="bd-m-edit" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
              {editing ? 'Done editing' : 'Edit title, author, cover'}
            </button>
          </div>
        </div>
        {editing && (
          <div className="bd-m-editor">
            {fields}
            <CoverEditor book={book} mobile />
          </div>
        )}
        {progress}
        {facts}
        <ShelvesAndTags book={book} mobile />
        <Bookmarks book={book} />
        <Contents book={book} wpm={wpm} mobile />
      </>
    );
  }

  return (
    <>
      <div className="bd-head">
        <CoverEditor book={book} mobile={false} />
        {fields}
      </div>
      {facts}
      {progress}
      <ShelvesAndTags book={book} mobile={false} />
      <Bookmarks book={book} />
      <Contents book={book} wpm={wpm} mobile={false} />
    </>
  );
}

export function BookDetails() {
  const activeBookId = useAppStore((s) => s.activeBookId);
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const openReader = useAppStore((s) => s.openReader);
  const book = useBook(activeBookId);
  const isMobile = useIsMobile();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!book) closeOverlay();
  }, [book, closeOverlay]);

  if (!book) return null;

  const status = bookStatus(book);
  const resume = () => (status === 'finished' ? openReader(book.id, 0) : openReader(book.id));
  const resumeLabel = status === 'unread' ? 'Start reading' : status === 'finished' ? 'Read again' : 'Resume';

  const confirm = confirming && <ConfirmRemoveBook book={book} onClose={() => setConfirming(false)} />;

  if (isMobile) {
    return (
      <Sheet onClose={closeOverlay} label="Book details" top={96} className="bd-sheet">
        <div className="bd-m-header">
          <span className="bd-title-label">Details</span>
          <button type="button" className="bd-m-close" aria-label="Close" onClick={closeOverlay}>
            <X size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
        <div className="bd-body is-mobile">
          <DetailsBody book={book} mobile />
          <button type="button" className="btn btn-text bd-remove is-mobile" onClick={() => setConfirming(true)}>
            Remove from library
          </button>
        </div>
        <footer className="bd-m-footer">
          <button type="button" className="btn btn-primary bd-m-resume" onClick={resume}>
            <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            {resumeLabel}
          </button>
        </footer>
        {confirm}
      </Sheet>
    );
  }

  return (
    <Drawer onClose={closeOverlay} label="Book details" className="bd-drawer">
      <header className="bd-header">
        <span className="bd-title-label">Details</span>
        <button type="button" className="icon-btn" aria-label="Close" onClick={closeOverlay}>
          <X size={18} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </header>
      <div className="bd-body">
        <DetailsBody book={book} mobile={false} />
      </div>
      <footer className="bd-footer">
        <button type="button" className="btn btn-text bd-remove" onClick={() => setConfirming(true)}>
          Remove from library
        </button>
        <button type="button" className="btn btn-primary bd-resume" onClick={resume}>
          <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          {resumeLabel}
        </button>
      </footer>
      {confirm}
    </Drawer>
  );
}
