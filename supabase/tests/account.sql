-- Account deletion + quota test. Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/account.sql
begin;
create temp table results(name text, ok boolean);
grant all on results to public;

insert into auth.users (id, instance_id, aud, role, email) values
 ('aaaaaaaa-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acc-a@test.invalid'),
 ('bbbbbbbb-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acc-b@test.invalid');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true);
insert into books (id,title,format) values ('a0000000-0000-0000-0000-000000000001','A book','epub');
insert into shelves (name) values ('A shelf');
insert into bookmarks (book_id,word_index) values ('a0000000-0000-0000-0000-000000000001',3);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true);
insert into books (id,title,format) values ('b0000000-0000-0000-0000-000000000001','B book','epub');

-- quota (as user A, tiny limit)
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true);
select set_config('app.storage_quota_bytes','1000',true);
insert into storage.objects (bucket_id,name,owner_id,metadata) values
 ('books','aaaaaaaa-0000-0000-0000-00000000000a/1.epub','aaaaaaaa-0000-0000-0000-00000000000a','{"size":600}');
insert into results select 'usage totals', used_bytes = 600 and limit_bytes = 1000 from my_storage_usage();
do $$ declare ok boolean; begin
  begin
    insert into storage.objects (bucket_id,name,owner_id,metadata) values
     ('books','aaaaaaaa-0000-0000-0000-00000000000a/2.epub','aaaaaaaa-0000-0000-0000-00000000000a','{"size":600}');
    ok := false;
  exception when others then ok := sqlerrm like 'Storage quota exceeded%'; end;
  insert into results values ('over-quota insert rejected', ok);
  insert into storage.objects (bucket_id,name,owner_id,metadata) values
   ('books','aaaaaaaa-0000-0000-0000-00000000000a/3.epub','aaaaaaaa-0000-0000-0000-00000000000a','{"size":400}');
  insert into results values ('insert up to limit allowed', true);
end $$;
select set_config('app.storage_quota_bytes','',true);
insert into results select 'default limit is 1 GB', limit_bytes = 1073741824 from my_storage_usage();

-- anon cannot call
reset role; set local role anon;
do $$ declare ok boolean; begin
  begin perform public.delete_my_account(); ok := false;
  exception when insufficient_privilege then ok := true; end;
  insert into results values ('anon cannot call delete_my_account', ok);
end $$;

-- A deletes self
reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true);
select delete_my_account();
reset role;
insert into results select 'A auth user gone', not exists (select 1 from auth.users where id='aaaaaaaa-0000-0000-0000-00000000000a');
insert into results select 'A public rows gone', (select count(*) from books where user_id='aaaaaaaa-0000-0000-0000-00000000000a')
  + (select count(*) from shelves where user_id='aaaaaaaa-0000-0000-0000-00000000000a')
  + (select count(*) from bookmarks where user_id='aaaaaaaa-0000-0000-0000-00000000000a')
  + (select count(*) from profiles where id='aaaaaaaa-0000-0000-0000-00000000000a') = 0;
insert into results select 'B untouched', exists (select 1 from auth.users where id='bbbbbbbb-0000-0000-0000-00000000000b')
  and exists (select 1 from books where user_id='bbbbbbbb-0000-0000-0000-00000000000b');

select name, ok from results order by ok, name;
do $$ begin if exists (select 1 from results where not ok) then raise exception 'account tests failed'; end if; end $$;
rollback;
