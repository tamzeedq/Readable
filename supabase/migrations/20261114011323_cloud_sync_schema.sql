-- Cloud sync schema for Readable: library metadata, progress, prefs, stats.
-- Full book text is never stored; originals live in the private `books` bucket.
-- Client ids (crypto.randomUUID) are used as primary keys. Rows are scoped by user_id.
-- updated_at is server-set on every write (last-write-wins); deleted_at is a tombstone for sync.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- profiles ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- books ------------------------------------------------------------------
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  author text not null default '',
  format text not null check (format in ('epub','pdf','txt','paste')),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  word_count integer not null default 0 check (word_count >= 0),
  chapters jsonb not null default '[]'::jsonb,       -- [{title,startWord}]
  progress_word_index integer not null default 0 check (progress_word_index >= 0),
  last_read_at timestamptz,
  added_at timestamptz not null default now(),
  finished_at timestamptz,
  tags text[] not null default '{}',
  description text,
  has_cover boolean not null default false,
  cover_hue integer not null default 0 check (cover_hue between 0 and 360),
  wpm integer check (wpm is null or wpm > 0),
  appearance jsonb,                                   -- per-book Partial<AppearancePrefs>
  skip_images boolean,
  content_hash text,                                  -- sha-256 hex of original file, for dedupe
  storage_path text,                                  -- books bucket object path: {user_id}/{book_id}.{ext}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);
create index books_user_updated_idx on public.books (user_id, updated_at);
create index books_user_hash_idx on public.books (user_id, content_hash);

-- shelves ----------------------------------------------------------------
create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);
create index shelves_user_updated_idx on public.shelves (user_id, updated_at);

-- book_shelves (composite FKs guarantee both sides belong to the same user)
create table public.book_shelves (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  book_id uuid not null,
  shelf_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (book_id, shelf_id),
  foreign key (book_id, user_id) references public.books (id, user_id) on delete cascade,
  foreign key (shelf_id, user_id) references public.shelves (id, user_id) on delete cascade
);
create index book_shelves_user_updated_idx on public.book_shelves (user_id, updated_at);

-- reading_progress: per-book position (one row per book) ---------------------
create table public.reading_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  book_id uuid not null,
  word_index integer not null default 0 check (word_index >= 0),
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (book_id),
  foreign key (book_id, user_id) references public.books (id, user_id) on delete cascade
);
create index reading_progress_user_updated_idx on public.reading_progress (user_id, updated_at);

-- bookmarks ---------------------------------------------------------------
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  book_id uuid not null,
  word_index integer not null check (word_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (book_id, word_index),
  foreign key (book_id, user_id) references public.books (id, user_id) on delete cascade
);
create index bookmarks_user_updated_idx on public.bookmarks (user_id, updated_at);

-- preferences: one row per user, prefs as jsonb --------------------------------
create table public.preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  reading jsonb not null default '{}'::jsonb,        -- ReadingPrefs
  appearance jsonb not null default '{}'::jsonb,     -- AppearancePrefs
  theme_mode text check (theme_mode in ('light','dark','system')),
  palette text check (palette in ('sepia','moss')),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- reading_sessions: per day per book totals (mirrors ReadingLog) --------------
create table public.reading_sessions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  book_id uuid not null,
  day date not null,
  ms bigint not null default 0 check (ms >= 0),
  words integer not null default 0 check (words >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (book_id, day),
  foreign key (book_id, user_id) references public.books (id, user_id) on delete cascade
);
create index reading_sessions_user_day_idx on public.reading_sessions (user_id, day);
create index reading_sessions_user_updated_idx on public.reading_sessions (user_id, updated_at);

-- updated_at triggers + RLS -----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','books','shelves','book_shelves','reading_progress',
                           'bookmarks','preferences','reading_sessions']
  loop
    execute format('create trigger set_updated_at before insert or update on public.%I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles keyed by id; no client insert/delete (trigger + cascade handle those)
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['books','shelves','book_shelves','reading_progress',
                           'bookmarks','preferences','reading_sessions']
  loop
    execute format('create policy %1$s_select_own on public.%1$I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy %1$s_insert_own on public.%1$I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy %1$s_update_own on public.%1$I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy %1$s_delete_own on public.%1$I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- Table privileges: signed-in users only; anon gets nothing.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.books, public.shelves, public.book_shelves,
  public.reading_progress, public.bookmarks, public.preferences, public.reading_sessions to authenticated;
grant select, update on public.profiles to authenticated;

-- Storage: private `books` bucket, objects under {user_id}/... ---------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('books', 'books', false, 262144000)
on conflict (id) do nothing;

create policy books_objects_select_own on storage.objects for select to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy books_objects_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy books_objects_update_own on storage.objects for update to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy books_objects_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
