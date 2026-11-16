import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when Supabase env vars are set. Without them the app is local-only and no client exists. */
export const isSyncConfigured = Boolean(url && key);

/** Typed client, or null when Supabase isn't configured. Only the anon key ever reaches the browser. */
export const supabase: SupabaseClient<Database> | null = isSyncConfigured
  ? createClient<Database>(url as string, key as string)
  : null;
