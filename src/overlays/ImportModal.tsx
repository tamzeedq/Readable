import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Play, Upload, X } from 'lucide-react';
import { Modal, Sheet } from '../components/ui/Overlay';
import { notify } from '../components/ui/Toaster';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAppStore } from '../store/appStore';
import { IMPORT_ACCEPT, createBookFromText, importFile } from '../lib/importer';
import { countWords, formatBytes, formatMinutes, formatNumber } from '../lib/format';
import type { Book } from '../types';
import './ImportModal.css';

type RowStatus = 'importing' | 'ready' | 'error';

interface ImportRow {
  id: string;
  name: string;
  size: number;
  status: RowStatus;
  percent: number;
  detail: string;
  error?: string;
  book?: Book;
}

const MAX_CONCURRENT = 2;

// Rows live at module level so an import keeps its list while switching tabs or if the modal remounts.
let rowsCache: ImportRow[] = [];

export function ImportModal() {
  const overlay = useAppStore((s) => s.overlay);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const isMobile = useIsMobile();
  const tab: 'files' | 'paste' = overlay === 'paste' ? 'paste' : 'files';

  const tabs = (
    <div role="tablist" aria-label="Import method" className="imp-tabs">
      {(['files', 'paste'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          id={`imp-tab-${t}`}
          aria-selected={tab === t}
          aria-controls={`imp-panel-${t}`}
          tabIndex={tab === t ? 0 : -1}
          className={`imp-tab ${tab === t ? 'is-active' : ''}`}
          onClick={() => openOverlay(t === 'files' ? 'import' : 'paste')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const next = tab === 'files' ? 'paste' : 'files';
              openOverlay(next === 'files' ? 'import' : 'paste');
              requestAnimationFrame(() => document.getElementById(`imp-tab-${next}`)?.focus());
            }
          }}
        >
          {t === 'files' ? 'Files' : 'Paste text'}
        </button>
      ))}
    </div>
  );

  const header = (
    <header className="imp-header">
      <div className="imp-header-row">
        <h2 className="imp-title">Add to your library</h2>
        <button type="button" className="imp-close" aria-label="Close" onClick={closeOverlay}>
          <X size={18} strokeWidth={1.6} />
        </button>
      </div>
      {tabs}
    </header>
  );

  const body = tab === 'files' ? <FilesTab mobile={isMobile} /> : <PasteTab mobile={isMobile} />;

  if (isMobile) {
    return (
      <Sheet onClose={closeOverlay} label="Add to your library" top={64} className="imp imp-mobile">
        {header}
        {body}
      </Sheet>
    );
  }
  return (
    <Modal onClose={closeOverlay} label="Add to your library" className="imp imp-desktop">
      {header}
      {body}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Files tab
// ---------------------------------------------------------------------------

function FilesTab({ mobile }: { mobile: boolean }) {
  const openLibrary = useAppStore((s) => s.openLibrary);
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const [rows, setRowsState] = useState<ImportRow[]>(rowsCache);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const queue = useRef<{ id: string; file: File }[]>([]);
  const active = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setRows = useCallback((fn: (rows: ImportRow[]) => ImportRow[]) => {
    rowsCache = fn(rowsCache);
    if (mounted.current) setRowsState(rowsCache);
  }, []);

  const patchRow = useCallback(
    (id: string, patch: Partial<ImportRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    [setRows],
  );

  const pump = useCallback(() => {
    while (active.current < MAX_CONCURRENT && queue.current.length) {
      const { id, file } = queue.current.shift()!;
      active.current++;
      let lastPaint = 0;
      Promise.resolve()
        .then(() =>
      importFile(file, ({ percent, detail }) => {
        const now = performance.now();
        if (now - lastPaint < 60 && percent < 99) return; // throttle re-renders
        lastPaint = now;
        patchRow(id, { percent, detail });
      }),
        )
        .then((book) => patchRow(id, { status: 'ready', percent: 100, book }))
        .catch((e: unknown) => {
          const error = e instanceof Error && e.message ? e.message : 'This file couldn’t be read';
          patchRow(id, { status: 'error', error });
          if (e instanceof Error && e.name === 'StorageFullError') notify(error, 'error');
        })
        .finally(() => {
          active.current--;
          pump();
        });
    }
  }, [patchRow]);

  const addFiles = useCallback(
    (list: FileList | File[] | null) => {
      const files = Array.from(list ?? []);
      if (!files.length) return;
      const newRows: ImportRow[] = files.map((f, i) => ({
        id: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        size: f.size,
        status: 'importing',
        percent: 0,
        detail: 'waiting',
      }));
      setRows((rs) => [...rs, ...newRows]);
      newRows.forEach((r, i) => queue.current.push({ id: r.id, file: files[i] }));
      pump();
    },
    [pump, setRows],
  );

  const counts = useMemo(() => {
    const c = { ready: 0, importing: 0, error: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);

  const summary = [
    counts.ready && `${counts.ready} ready`,
    counts.importing && `${counts.importing} importing`,
    counts.error && `${counts.error} can’t be read`,
  ]
    .filter(Boolean)
    .join(' · ');

  const done = () => {
    const anyReady = counts.ready > 0;
    // Clear finished rows; in-flight imports keep running and stay listed next time.
    rowsCache = rowsCache.filter((r) => r.status === 'importing');
    if (anyReady || counts.importing) openLibrary();
    else closeOverlay();
  };

  const dropHandlers = mobile
    ? {}
    : {
        onDragEnter: (e: React.DragEvent) => {
          if (!Array.from(e.dataTransfer.types).includes('Files')) return;
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        },
        onDragOver: (e: React.DragEvent) => {
          if (!Array.from(e.dataTransfer.types).includes('Files')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave: () => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragging(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          addFiles(e.dataTransfer.files);
        },
      };

  return (
    <>
      <div className="imp-body imp-files" id="imp-panel-files" role="tabpanel" aria-labelledby="imp-tab-files">
        <div className={`imp-drop ${dragging ? 'is-dragging' : ''}`} {...dropHandlers}>
          <Upload size={mobile ? 28 : 30} strokeWidth={1.4} className="imp-drop-icon" aria-hidden="true" />
          <div className="imp-drop-title">{mobile ? 'EPUB, PDF or TXT' : dragging ? 'Drop to add' : 'Drop EPUB, PDF or TXT files'}</div>
          <div className="imp-drop-note">Files stay on this device</div>
          <button type="button" className="imp-choose" onClick={() => inputRef.current?.click()}>
            {mobile ? 'Choose from Files' : 'Choose files'}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={IMPORT_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {rows.length > 0 && (
          <ul className="imp-rows" aria-live="polite">
            {rows.map((r) => (
              <ImportRowView key={r.id} row={r} mobile={mobile} onRemove={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />
            ))}
          </ul>
        )}
      </div>
      <footer className="imp-footer imp-footer-files">
        <span className="imp-summary" aria-live="polite">
          {summary || (mobile ? 'Choose books to add' : 'Nothing added yet')}
        </span>
        <button type="button" className="imp-primary" onClick={done}>
          Done
        </button>
      </footer>
    </>
  );
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function ImportRowView({ row, mobile, onRemove }: { row: ImportRow; mobile: boolean; onRemove: () => void }) {
  let spine: ReactNode;
  let main: ReactNode;
  let status: ReactNode;

  if (row.status === 'ready' && row.book) {
    const b = row.book;
    spine = <span className="imp-spine" style={{ background: `oklch(var(--cover-l, 0.46) 0.07 ${b.coverHue})` }} />;
    main = (
      <div className="imp-row-text">
        <div className="imp-row-name">{b.title}</div>
        <div className="imp-row-meta">
          {mobile
            ? `${b.format.toUpperCase()} · ${formatNumber(b.wordCount)} words`
            : `${row.name} · ${formatBytes(row.size)} · ${formatNumber(b.wordCount)} words`}
        </div>
      </div>
    );
    status = (
      <span className="imp-ready">
        <Check size={15} strokeWidth={2} aria-hidden="true" />
        Ready
      </span>
    );
  } else if (row.status === 'error') {
    spine = <span className="imp-spine imp-spine-dashed" />;
    main = (
      <div className="imp-row-text">
        <div className="imp-row-name">{row.name}</div>
        <div className="imp-row-meta">
          {mobile && row.error ? row.error.replace(/^This (PDF|file|EPUB) is /, (_m, w: string) => (w === 'PDF' ? '' : `This ${w} is `)).replace(/^./, (c) => c.toUpperCase()) : row.error}
        </div>
      </div>
    );
    status = (
      <button type="button" className="imp-remove" onClick={onRemove} aria-label={`Remove ${row.name}`}>
        Remove
      </button>
    );
  } else {
    const detail = row.detail === 'waiting' ? 'waiting to start' : row.detail;
    spine = <span className="imp-spine imp-spine-pending" />;
    main = (
      <div className="imp-row-text imp-row-progress">
        <div>
          <div className="imp-row-name">{row.name}</div>
          <div className="imp-row-meta">
            {mobile ? capitalize(detail).replace(/, /, ' · ') : `${formatBytes(row.size)} · ${detail}`}
          </div>
        </div>
        <div className="imp-bar" role="progressbar" aria-label={`Importing ${row.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(row.percent)}>
          <span style={{ width: `${Math.max(2, Math.min(100, row.percent))}%` }} />
        </div>
      </div>
    );
    status = <span className="imp-pct">{Math.round(row.percent)}%</span>;
  }

  return (
    <li className="imp-row">
      {spine}
      {main}
      {status}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Paste tab
// ---------------------------------------------------------------------------

function formatReadTime(words: number, wpm: number): string {
  const seconds = Math.round((words / Math.max(1, wpm)) * 60);
  if (seconds < 60) return `About ${Math.max(1, seconds)} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `About ${minutes} minute${minutes === 1 ? '' : 's'}`;
  return `About ${formatMinutes(minutes)}`;
}

// Draft survives tab switches within a session
let pasteDraft = { title: '', text: '', save: true };

function PasteTab({ mobile }: { mobile: boolean }) {
  const wpm = useAppStore((s) => s.readingPrefs.defaultWpm);
  const openReader = useAppStore((s) => s.openReader);
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const [title, setTitle] = useState(pasteDraft.title);
  const [text, setText] = useState(pasteDraft.text);
  const [save, setSave] = useState(pasteDraft.save);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    pasteDraft = { title, text, save };
  }, [title, text, save]);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const words = useMemo(() => countWords(text), [text]);
  const canStart = words > 0 && !busy;

  const start = async () => {
    if (!canStart) return;
    setBusy(true);
    setError(null);
    try {
      const book = await createBookFromText(title, text, { transient: !save });
      pasteDraft = { title: '', text: '', save: true };
      openReader(book.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t read this text');
      setBusy(false);
    }
  };

  const checkbox = (
    <label className="imp-check">
      <input type="checkbox" className="sr-only" checked={save} onChange={(e) => setSave(e.target.checked)} />
      <span className="imp-check-box" aria-hidden="true">
        {save && <Check size={mobile ? 13 : 12} strokeWidth={3} />}
      </span>
      Save to library
    </label>
  );

  const startButton = (
    <button type="button" className={`imp-primary imp-start ${mobile ? 'imp-block' : ''}`} disabled={!canStart} onClick={start}>
      <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      Start reading
    </button>
  );

  return (
    <>
      <div className="imp-body imp-paste" id="imp-panel-paste" role="tabpanel" aria-labelledby="imp-tab-paste">
        <label className="imp-field-label">
          Title
          <input
            type="text"
            className="imp-input"
            value={title}
            placeholder="Untitled"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                textRef.current?.focus();
              }
            }}
          />
        </label>
        <label className="imp-field-label">
          Text
          <textarea
            ref={textRef}
            className="imp-textarea"
            value={text}
            placeholder="Paste an article, a memo, a chapter…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void start();
              }
            }}
          />
        </label>
        <div className="imp-counts" aria-live="polite">
          <span>
            {formatNumber(words)} {words === 1 ? 'word' : 'words'}
          </span>
          {words > 0 && (
            <span className="imp-italic">
              {formatReadTime(words, wpm)} at {wpm} wpm
            </span>
          )}
        </div>
        {error && (
          <div className="imp-error" role="alert">
            {error}
          </div>
        )}
        {mobile && checkbox}
      </div>
      {mobile ? (
        <footer className="imp-footer imp-footer-paste">{startButton}</footer>
      ) : (
        <footer className="imp-footer">
          {checkbox}
          <div className="imp-footer-actions">
            <button type="button" className="imp-secondary" onClick={closeOverlay}>
              Cancel
            </button>
            {startButton}
          </div>
        </footer>
      )}
    </>
  );
}
