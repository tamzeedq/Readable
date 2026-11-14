import { useState, type FormEvent } from 'react';
import { authMessage, requestPasswordReset, signIn, signOut, signUp, useAuth } from '../../lib/auth';
import { SectionHead, SettingRow } from './sections';

type Mode = 'sign-in' | 'sign-up';

export function AccountSection({ mobile }: { mobile?: boolean }) {
  const { status, user } = useAuth();
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
          <SettingRow title="Your library stays on this device" desc="Syncing books across devices isn’t part of accounts yet." />
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
            desc="Readable works fully without one. An account will let you sync across devices when that arrives."
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
      <SectionHead title="Account" id="set-account-h" hidden={mobile} intro={mobile ? undefined : 'Optional. Sign in to prepare for syncing across devices.'} />
      {body}
    </section>
  );
}
