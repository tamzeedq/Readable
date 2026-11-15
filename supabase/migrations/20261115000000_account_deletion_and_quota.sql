-- Account deletion + per-user storage quota.
--
-- Account deletion contract:
--   1. The client first deletes its own objects in the `books` bucket via the Storage API
--      (SQL cannot remove the underlying files from object storage).
--   2. The client then calls rpc('delete_my_account'), which deletes the caller's auth.users
--      row; every public row cascades from it.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Quota: the ONE place to change the default limit (bytes). Override per-session/test
-- with set_config('app.storage_quota_bytes', '<n>', true).
create or replace function public.storage_quota_bytes()
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('app.storage_quota_bytes', true), '')::bigint,
                  1073741824::bigint)  -- 1 GB default
$$;

create or replace function public.storage_used_bytes(uid uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce((metadata->>'size')::bigint, 0)), 0)::bigint
  from storage.objects
  where bucket_id = 'books' and (storage.foldername(name))[1] = uid::text
$$;
revoke all on function public.storage_used_bytes(uuid) from public, anon, authenticated;

create or replace function public.my_storage_usage()
returns table (used_bytes bigint, limit_bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select public.storage_used_bytes(auth.uid()), public.storage_quota_bytes()
  where auth.uid() is not null
$$;
revoke all on function public.my_storage_usage() from public, anon;
grant execute on function public.my_storage_usage() to authenticated;

create or replace function public.enforce_books_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid text := (storage.foldername(new.name))[1];
  new_size bigint := coalesce((new.metadata->>'size')::bigint, 0);
begin
  if new.bucket_id <> 'books' or uid is null
     or uid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;
  if public.storage_used_bytes(uid::uuid) + new_size > public.storage_quota_bytes() then
    raise exception 'Storage quota exceeded (limit % bytes)', public.storage_quota_bytes()
      using errcode = 'P0001', hint = 'storage_quota_exceeded';
  end if;
  return new;
end;
$$;

drop trigger if exists books_quota on storage.objects;
create trigger books_quota before insert on storage.objects
  for each row execute function public.enforce_books_quota();
