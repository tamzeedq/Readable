import { useRef, useState } from 'react';
import { Modal } from '../../components/ui/Overlay';
import { notify } from '../../components/ui/Toaster';
import { BackupError, exportBackup, inspectBackup, restoreBackup, type RestoreMode } from '../../lib/backup';
import { dayKey } from '../../lib/format';
import { SectionHead, SettingRow } from './sections';

type Busy = { kind: 'export' | 'restore'; percent: number; detail: string } | null;

export function BackupSection({ mobile }: { mobile?: boolean }) {
  const [busy, setBusy] = useState<Busy>(null);
  const [pending, setPending] = useState<{ file: File; bookCount: number } | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fail = (e: unknown) => {
    const text = e instanceof BackupError || e instanceof Error ? e.message : 'Something went wrong.';
    setMessage({ text, error: true });
    notify(text, 'error');
  };

  const doExport = async () => {
    setMessage(null);
    setBusy({ kind: 'export', percent: 0, detail: 'starting' });
    try {
      const blob = await exportBackup((p) => setBusy({ kind: 'export', ...p }));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `readable-backup-${dayKey(new Date())}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage({ text: 'Backup saved to your downloads.' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    try {
      const m = await inspectBackup(file);
      setPending({ file, bookCount: m.bookCount });
    } catch (e) {
      fail(e);
    }
  };

  const doRestore = async () => {
    if (!pending) return;
    const { file } = pending;
    setPending(null);
    setBusy({ kind: 'restore', percent: 0, detail: 'starting' });
    try {
      const r = await restoreBackup(file, mode, (p) => setBusy({ kind: 'restore', ...p }));
      setMessage({
        text: `Restored ${r.added} ${r.added === 1 ? 'book' : 'books'}${r.skipped ? ` · ${r.skipped} already in your library` : ''}.`,
      });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="set-backup-h">
      <SectionHead
        title="Backup & restore"
        id="set-backup-h"
        hidden={mobile}
        intro={mobile ? undefined : 'Move your library to another device with a single file.'}
      />
      <div className="set-rows">
        <SettingRow title="Export library" desc="Books, shelves, bookmarks, progress, stats and settings in one .zip file.">
          <button type="button" className="btn btn-sm" disabled={!!busy} onClick={doExport}>
            Export…
          </button>
        </SettingRow>
        <SettingRow title="Restore from backup" desc="Add books from a backup, or replace your library with it.">
          <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => inputRef.current?.click()}>
            Choose file…
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </SettingRow>
      </div>
      {busy && (
        <div className="set-row-desc" role="status" style={{ marginTop: 12 }}>
          {busy.kind === 'export' ? 'Exporting' : 'Restoring'} · {busy.detail} · {Math.round(busy.percent)}%
          <progress value={busy.percent} max={100} aria-label="Progress" style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </div>
      )}
      {message && (
        <div className="set-row-desc" role={message.error ? 'alert' : 'status'} style={{ marginTop: 12, color: message.error ? 'var(--accent-text)' : undefined }}>
          {message.text}
        </div>
      )}

      {pending && (
        <Modal label="Restore backup" onClose={() => setPending(null)} className="set-confirm">
          <div className="set-confirm-body">
            <h2>
              Restore {pending.bookCount} {pending.bookCount === 1 ? 'book' : 'books'}?
            </h2>
            <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0' }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge — add
                books you don’t have, skip duplicates
              </label>
              <label style={{ display: 'block' }}>
                <input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace —
                delete everything here and use the backup
              </label>
            </fieldset>
            {mode === 'replace' && <p>Your current library, progress and settings will be overwritten. This can’t be undone.</p>}
          </div>
          <footer className="set-confirm-foot">
            <button type="button" className="btn" onClick={() => setPending(null)} autoFocus>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={doRestore}>
              {mode === 'replace' ? 'Replace library' : 'Merge into library'}
            </button>
          </footer>
        </Modal>
      )}
    </section>
  );
}
