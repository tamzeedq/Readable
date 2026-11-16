-- RLS isolation test. Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- Everything runs in a transaction that is rolled back. Exits non-zero on failure.
begin;

create temp table results(name text, ok boolean);
grant all on results to public;

-- every public table has RLS
insert into results select 'rls enabled: ' || c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

insert into auth.users (id, instance_id, aud, role, email) values
 ('aaaaaaaa-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-a@test.invalid'),
 ('bbbbbbbb-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-b@test.invalid');
insert into storage.objects (bucket_id, name, owner_id) values
 ('books','bbbbbbbb-0000-0000-0000-00000000000b/x.epub','bbbbbbbb-0000-0000-0000-00000000000b');

-- user B creates data
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true);
insert into books (id,title,format) values ('b0000000-0000-0000-0000-000000000001','B book','epub');
insert into shelves (id,name) values ('b0000000-0000-0000-0000-0000000000a1','B shelf');
insert into book_shelves (book_id,shelf_id) values ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-0000000000a1');
insert into reading_progress (book_id,word_index) values ('b0000000-0000-0000-0000-000000000001',5);
insert into bookmarks (book_id,word_index) values ('b0000000-0000-0000-0000-000000000001',3);
insert into preferences (reading) values ('{"defaultWpm":300}');
insert into reading_sessions (book_id,day,ms,words) values ('b0000000-0000-0000-0000-000000000001',current_date,1000,10);
insert into results select 'B sees own books', count(*) = 1 from books;

-- user A attacks
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true);

do $$
declare t text; n int; ok boolean;
begin
  foreach t in array array['profiles','books','shelves','book_shelves','reading_progress','bookmarks','preferences','reading_sessions'] loop
    execute format('select count(*) from public.%I where %s', t,
      case when t = 'profiles' then 'id <> auth.uid()' else 'user_id <> auth.uid()' end) into n;
    insert into results values ('A cannot select B rows in ' || t, n = 0);
  end loop;

  update books set title = 'pwned' where id = 'b0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count; insert into results values ('A cannot update B book', n = 0);
  delete from books where id = 'b0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count; insert into results values ('A cannot delete B book', n = 0);
  update bookmarks set word_index = 99; get diagnostics n = row_count;
  insert into results values ('A cannot update B bookmarks', n = 0);
  delete from preferences; get diagnostics n = row_count;
  insert into results values ('A cannot delete B preferences', n = 0);
  update profiles set display_name = 'pwned' where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  get diagnostics n = row_count; insert into results values ('A cannot update B profile', n = 0);

  -- inserts as B must fail
  begin
    insert into books (user_id,title,format) values ('bbbbbbbb-0000-0000-0000-00000000000b','x','txt');
    ok := false;
  exception when others then ok := true; end;
  insert into results values ('A cannot insert book as B', ok);
  -- attach A's data to B's book must fail (composite FK / policy)
  begin
    insert into bookmarks (book_id,word_index) values ('b0000000-0000-0000-0000-000000000001',1);
    ok := false;
  exception when others then ok := true; end;
  insert into results values ('A cannot bookmark B book', ok);

  -- storage
  select count(*) into n from storage.objects where bucket_id='books';
  insert into results values ('A cannot select B storage objects', n = 0);
  update storage.objects set name = 'aaaaaaaa-0000-0000-0000-00000000000a/stolen.epub' where bucket_id='books';
  get diagnostics n = row_count; insert into results values ('A cannot update B storage objects', n = 0);
  -- storage.protect_delete blocks raw deletes entirely (Storage API only); either outcome means B's object survives
  begin
    delete from storage.objects where bucket_id='books'; get diagnostics n = row_count; ok := (n = 0);
  exception when others then ok := true; end;
  insert into results values ('A cannot delete B storage objects', ok);
  begin
    insert into storage.objects (bucket_id,name,owner_id) values ('books','bbbbbbbb-0000-0000-0000-00000000000b/evil.epub','aaaaaaaa-0000-0000-0000-00000000000a');
    ok := false;
  exception when others then ok := true; end;
  insert into results values ('A cannot upload into B folder', ok);
  insert into storage.objects (bucket_id,name,owner_id) values ('books','aaaaaaaa-0000-0000-0000-00000000000a/mine.epub','aaaaaaaa-0000-0000-0000-00000000000a');
  select count(*) into n from storage.objects where bucket_id='books';
  insert into results values ('A can upload/see own storage object', n = 1);
end $$;

-- anon sees nothing / cannot write
reset role; set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$
declare ok boolean;
begin
  begin perform 1 from public.books; ok := false; exception when insufficient_privilege then ok := true; end;
  insert into results values ('anon cannot read books', ok);
  begin insert into public.books (user_id,title,format) values (gen_random_uuid(),'x','txt'); ok := false;
  exception when others then ok := true; end;
  insert into results values ('anon cannot write books', ok);
end $$;

reset role;
select name, case when ok then 'PASS' else 'FAIL' end as result from results order by ok, name;
do $$ begin
  if exists (select 1 from results where not ok) then raise exception 'RLS TESTS FAILED'; end if;
  raise notice 'ALL RLS TESTS PASSED (% checks)', (select count(*) from results);
end $$;
rollback;
