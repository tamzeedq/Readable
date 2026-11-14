import { useState, type FormEvent } from 'react';
import { authMessage, requestPasswordReset, signIn, signOut, signUp, useAuth } from '../../lib/auth';
import { retrySync, useSyncStatus } from '../../lib/sync/app';
import { SectionHead, SettingRow } from './sections';

function syncText(s: { state: string; lastSyncedAt: number | null; message: string | null }): string {
  switch (s.state) {
    case 'syncing':
      return 'Syncing…';
    case 'synced':
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

export function AccountSection({ mobile }: { mobile?: boolean }) {
  const { status, user } = useAuth();
  const sync = useSyncStatus();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

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
          <SettingRow
            title="Books on this device are kept"
            desc="The first time you sign in, your library here is merged with your account — nothing is deleted. If something was changed in both places, the most recent change wins."
          />
        </div>
        {noteEl}
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
      </>
    );
  }

  return (
    <section aria-labelledby="set-account-h">
      <SectionHead title="Account" id="set-account-h" hidden={mobile} intro={mobile ? undefined : 'Optional. Sign in to keep your library in sync across devices.'} />
      {body}
    </section>
  );
}
