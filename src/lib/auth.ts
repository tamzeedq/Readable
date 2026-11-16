// Optional accounts. The app is fully usable signed out; this only tracks who (if anyone) is signed in.
import { create } from 'zustand';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { isSyncConfigured, supabase } from './supabase';

export type AuthStatus = 'unavailable' | 'loading' | 'signed-out' | 'signed-in';

interface AuthState {
  status: AuthStatus;
  user: User | null;
}

export const useAuth = create<AuthState>(() => ({
  status: isSyncConfigured ? 'loading' : 'unavailable',
  user: null,
}));

let started = false;

/** Restore the stored session and follow auth changes. Safe to call more than once. */
export function initAuth(): void {
  if (started || !supabase) return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ status: session ? 'signed-in' : 'signed-out', user: session?.user ?? null });
  });
  supabase.auth
    .getSession()
    .then(({ data }) => useAuth.setState({ status: data.session ? 'signed-in' : 'signed-out', user: data.session?.user ?? null }))
    .catch(() => useAuth.setState({ status: 'signed-out', user: null }));
}

export class AuthError extends Error {}

/** Turn Supabase's errors into messages a reader can act on. */
export function friendlyAuthError(e: unknown): string {
  const err = e as { message?: string; code?: string; status?: number } | null;
  const msg = (err?.message ?? '').toLowerCase();
  const code = err?.code ?? '';
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'That email and password don’t match.';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'An account with this email already exists. Try signing in.';
  if (code === 'weak_password' || msg.includes('password should')) return 'Choose a longer password — at least 8 characters.';
  if (code === 'email_not_confirmed') return 'Confirm your email first — check your inbox for the link.';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || err?.status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (code === 'validation_failed' || msg.includes('valid email')) return 'Enter a valid email address.';
  if (code === 'signup_disabled') return 'New accounts aren’t being accepted right now.';
  if (msg.includes('fetch') || msg.includes('network')) return 'Couldn’t reach the server. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

function client() {
  if (!supabase) throw new AuthError('Sync isn’t available in this build.');
  return supabase;
}

const validate = (email: string, password: string) => {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new AuthError('Enter a valid email address.');
  if (password.length < 8) throw new AuthError('Choose a longer password — at least 8 characters.');
};

/** Resolves with `needsConfirmation: true` when the project requires email confirmation first. */
export async function signUp(email: string, password: string, displayName?: string): Promise<{ needsConfirmation: boolean }> {
  validate(email, password);
  const { data, error } = await client().auth.signUp({
    email: email.trim(),
    password,
    options: { data: displayName?.trim() ? { display_name: displayName.trim() } : {} },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!email.trim() || !password) throw new AuthError('Enter your email and password.');
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new AuthError('Enter your email address first.');
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
  if (error) throw error;
}

export function authMessage(e: unknown): string {
  return e instanceof AuthError ? e.message : friendlyAuthError(e);
}

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
}

/** Bytes of cloud book files used by the signed-in user, and their limit (`my_storage_usage()` RPC). */
export async function getStorageUsageWith(c: SupabaseClient<Database>): Promise<StorageUsage> {
  const { data, error } = await c.rpc('my_storage_usage');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { usedBytes: Number(row?.used_bytes ?? 0), limitBytes: Number(row?.limit_bytes ?? 0) };
}
export const getStorageUsage = () => getStorageUsageWith(client());

const BOOKS_BUCKET = 'books';

/**
 * Permanently delete the signed-in user's account. Contract with `delete_my_account()`: SQL cannot remove
 * storage files, so the client deletes its own objects first (Storage API), then calls the RPC, which
 * removes the auth user and cascades every row. Finally the local session is cleared. The local library
 * on this device is not touched; the sync layer detaches itself when the status becomes signed-out.
 */
export async function deleteAccountWith(c: SupabaseClient<Database>): Promise<void> {
  const { data } = await c.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new AuthError('You’re not signed in.');
  const bucket = c.storage.from(BOOKS_BUCKET);
  for (let guard = 0; guard < 1000; guard++) {
    const { data: objs, error } = await bucket.list(uid, { limit: 100 });
    if (error) throw error;
    const names = (objs ?? []).filter((o) => o.id).map((o) => `${uid}/${o.name}`);
    if (!names.length) break;
    const { error: rmErr } = await bucket.remove(names);
    if (rmErr) throw rmErr;
  }
  const { error } = await c.rpc('delete_my_account');
  if (error) throw error;
  // The user no longer exists server-side; clear the session locally without a server round-trip
  await c.auth.signOut({ scope: 'local' }).catch(() => undefined);
}
export const deleteAccount = () => deleteAccountWith(client());
