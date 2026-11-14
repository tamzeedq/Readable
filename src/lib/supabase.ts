/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase rows are untyped until gen_types is wired in */
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not configured. Using local-only mode.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Auth helpers
export const auth = {
  async signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
};

// Database helpers
export const db = {
  books: {
    async create(book: any) {
      const { data, error } = await supabase
        .from('books')
        .insert([book])
        .select();
      if (error) throw error;
      return data?.[0];
    },

    async getAll(userId: string) {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async update(id: string, updates: any) {
      const { data, error } = await supabase
        .from('books')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data?.[0];
    },

    async delete(id: string) {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  },

  sessions: {
    async create(session: any) {
      const { data, error } = await supabase
        .from('reading_sessions')
        .insert([session])
        .select();
      if (error) throw error;
      return data?.[0];
    },

    async getByBookId(bookId: string, userId: string) {
      const { data, error } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async update(id: string, updates: any) {
      const { data, error } = await supabase
        .from('reading_sessions')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data?.[0];
    },
  },

  userPreferences: {
    async get(userId: string) {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async upsert(userId: string, preferences: any) {
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
        })
        .select();
      if (error) throw error;
      return data?.[0];
    },
  },
};
