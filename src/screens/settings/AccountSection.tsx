import { useEffect, useState, type FormEvent } from 'react';
import { authMessage, deleteAccount, getStorageUsage, type StorageUsage, requestPasswordReset, signIn, signOut, signUp, useAuth } from '../../lib/auth';
import { retrySync, useSyncStatus } from '../../lib/sync/app';
import { formatBytes } from '../../lib/format';
import { LegalDocument, LegalLinks, type LegalDoc } from './Legal';
import { SectionHead, SettingRow } from './sections';

function syncText(s: { state: string; lastSyncedAt: number | null; message: string | null }): string {
  switch (s.state) {
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      if (s.message) return s.message;
      return s.lastSyncedAt ? `Up to date · ${new Date(s.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Up to date';
    case 'offline':
      return s.message ?? 'Offline — will sync when you’re back online';
    case 'error':
      return `Sync problem: ${s.message ?? 'something went wrong'}`;
    default:
      return 'Waiting to sync…';
  }
}

type Mode = 'sign-in' | 'sign-up';

const CONFIRM_WORD = 'DELETE';

function StorageMeter({ usage }: { usage: StorageUsage }) {
  const pct = usage.limitBytes ? Math.min(100, Math.round((usage.usedBytes / usage.limitBytes) * 100)) : 0;
  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 180 }}>
      <div role="progressbar" aria-label="Cloud storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ height: 6, borderRadius: 3, background: 'var(--border, #ddd)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--accent-text)' : 'currentColor' }} />
      </div>
      <span className="set-row-desc">
        {formatBytes(usage.usedBytes)} of {formatBytes(usage.limitBytes)} used
      </span>
    </div>
  );
}

function DeleteAccount({ busy, onDelete }: { busy: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  if (!open) {
    return (
      <SettingRow
        title="Delete account"
        desc="Permanently removes your account, your synced data and your uploaded book files from our servers. Books already on this device stay here."
      >
        <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
          Delete account…
        </button>
      </SettingRow>
    );
  }
  return (
    <SettingRow
      stack
      title="Delete your account?"
      desc={`This can’t be undone. Your library on this device is kept, but it will no longer sync. Type ${CONFIRM_WORD} to confirm.`}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="imp-input" aria-label={`Type ${CONFIRM_WORD} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" style={{ maxWidth: 160 }} />
        <button type="button" className="btn btn-sm" disabled={busy || typed.trim() !== CONFIRM_WORD} onClick={onDelete}>
          Delete permanently
        </button>
        <button type="button" className="btn btn-text" disabled={busy} onClick={() => { setOpen(false); setTyped(''); }}>
          Cancel
        </button>
      </div>
    </SettingRow>
  );
}

export function AccountSection({ mobile }: { mobile?: boolean }) {
  const [legal, setLegal] = useState<LegalDoc | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const { status, user } = useAuth();
  const sync = useSyncStatus();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setUsage(null);
      return;
    }
    let cancelled = false;
    getStorageUsage().then((u) => !cancelled && setUsage(u), () => undefined);
    return () => { cancelled = true; };
  }, [userId, sync.lastSyncedAt]);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setNote(null);
    try {
      const text = await fn();
      if (text) setNote({ text });
    } catch (e) {
      setNote({ text: authMessage(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        const r = await signUp(email, password, name);
        if (r.needsConfirmation) return 'Check your email to confirm your account, then sign in.';
      }
      setPassword('');
    });
  };

  const noteEl = note && (
    <div className="set-row-desc" role={note.error ? 'alert' : 'status'} style={{ marginTop: 12, color: note.error ? 'var(--accent-text)' : undefined }}>
      {note.text}
    </div>
  );

  let body;
  if (status === 'unavailable') {
    body = (
      <div className="set-rows">
        <SettingRow
          title="Sync isn’t available"
          desc="This copy of Readable isn’t connected to an account service. Everything works on this device without one."
        />
      </div>
    );
  } else if (status === 'loading') {
    body = (
      <div className="set-rows">
        <SettingRow title="Checking your account…" />
      </div>
    );
  } else if (status === 'signed-in' && user) {
    body = (
      <>
        <div className="set-rows">
          <SettingRow title="Signed in" desc={user.email}>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(signOut)}>
              Sign out
            </button>
          </SettingRow>
          <SettingRow title="Sync" desc={syncText(sync)}>
            {(sync.state === 'error' || sync.state === 'offline') && (
              <button type="button" className="btn btn-sm" onClick={retrySync}>
                Retry
              </button>
            )}
          </SettingRow>
          {usage && (
            <SettingRow title="Cloud storage" desc={sync.quotaExceeded ? 'You’ve reached your limit. New books won’t upload until you free up space; everything else keeps syncing.' : undefined}>
              <StorageMeter usage={usage} />
            </SettingRow>
          )}
          <SettingRow
            title="Books on this device are kept"
            desc="The first time you sign in, your library here is merged with your account — nothing is deleted. If something was changed in both places, the most recent change wins."
          />
          <DeleteAccount busy={busy} onDelete={() => void run(async () => { await deleteAccount(); setNote({ text: 'Your account was deleted. Your library is still on this device.' }); })} />
        </div>
        {noteEl}
        <div style={{ marginTop: 16 }}><LegalLinks onOpen={setLegal} /></div>
      </>
    );
  } else {
    body = (
      <>
        <div className="set-rows">
          <SettingRow
            title="Accounts are optional"
            desc="Readable works fully without one. With an account, your library, progress, bookmarks, shelves, settings and stats sync across your devices. Books already on this device are merged in, never deleted."
          />
        </div>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 16, maxWidth: 360 }} noValidate>
          {mode === 'sign-up' && (
            <label className="set-row-title" style={{ display: 'grid', gap: 4 }}>
              Name (optional)
              <input className="imp-input" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="set-row-title" style={{ display: 'grid', gap: 4 }}>
            Email
            <input className="imp-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="set-row-title" style={{ display: 'grid', gap: 4 }}>
            Password
            <input
              className="imp-input"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
            <button type="button" className="btn btn-text" disabled={busy} onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setNote(null); }}>
              {mode === 'sign-in' ? 'Create an account' : 'I have an account'}
            </button>
          </div>
          {mode === 'sign-up' && <LegalLinks onOpen={setLegal} prefix="By creating an account you agree to the " />}
          {mode === 'sign-in' && (
            <button
              type="button"
              className="btn btn-text"
              style={{ justifySelf: 'start', padding: 0, height: 'auto' }}
              disabled={busy}
              onClick={() => void run(async () => { await requestPasswordReset(email); return 'If that email has an account, a reset link is on its way.'; })}
            >
              Forgot your password?
            </button>
          )}
        </form>
        {noteEl}
        <div style={{ marginTop: 16 }}><LegalLinks onOpen={setLegal} /></div>
      </>
    );
  }

  if (legal) {
    return (
      <section aria-labelledby="set-account-h">
        <SectionHead title="Account" id="set-account-h" hidden={mobile} />
        <LegalDocument doc={legal} onBack={() => setLegal(null)} />
      </section>
    );
  }

  return (
    <section aria-labelledby="set-account-h">
      <SectionHead title="Account" id="set-account-h" hidden={mobile} intro={mobile ? undefined : 'Optional. Sign in to keep your library in sync across devices.'} />
      {body}
    </section>
  );
}
