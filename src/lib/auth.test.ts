import { afterEach, describe, expect, it, vi } from 'vitest';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('auth without Supabase env', () => {
  it('is unavailable and initAuth is a harmless no-op', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const errors = vi.spyOn(console, 'error');
    const { useAuth, initAuth, signIn } = await import('./auth');
    const { supabase, isSyncConfigured } = await import('./supabase');
    expect(isSyncConfigured).toBe(false);
    expect(supabase).toBeNull();
    initAuth();
    expect(useAuth.getState().status).toBe('unavailable');
    await expect(signIn('a@b.co', 'password1')).rejects.toThrow(/isn’t available/);
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('auth friendly errors', () => {
  it('maps known codes', async () => {
    const { friendlyAuthError } = await import('./auth');
    expect(friendlyAuthError({ code: 'invalid_credentials' })).toMatch(/don’t match/);
    expect(friendlyAuthError({ code: 'user_already_exists' })).toMatch(/already exists/);
    expect(friendlyAuthError(new Error('boom'))).toMatch(/Something went wrong/);
  });
});

// Integration: runs against the dev Supabase when SUPABASE_URL / SUPABASE_ANON_KEY are set.
describe.skipIf(!URL_ || !KEY)('auth against dev Supabase', () => {
  it('signs up, signs out, signs in, and has a profiles row', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', URL_!);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', KEY!);
    const { signUp, signIn, signOut, useAuth, initAuth } = await import('./auth');
    const { supabase } = await import('./supabase');
    initAuth();
    const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const password = 'correct-horse-battery';

    await signUp(email, password, 'Test Reader');
    await vi.waitFor(() => expect(useAuth.getState().status).toBe('signed-in'));
    const id = useAuth.getState().user!.id;

    await signOut();
    await vi.waitFor(() => expect(useAuth.getState().status).toBe('signed-out'));

    await signIn(email, password);
    await vi.waitFor(() => expect(useAuth.getState().user?.id).toBe(id));

    const { data, error } = await supabase!.from('profiles').select('id, display_name').eq('id', id).single();
    expect(error).toBeNull();
    expect(data).toEqual({ id, display_name: 'Test Reader' });
  }, 30000);
});
