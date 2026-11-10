begin;
truncate public.couples,public.profiles,public.operation_receipts cascade;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000061','entry-first@example.test',now()),
 ('00000000-0000-4000-8000-000000000062','entry-partner@example.test',now());
insert into public.profiles(user_id,display_name) values
 ('00000000-0000-4000-8000-000000000061','First'),('00000000-0000-4000-8000-000000000062','Partner');
insert into public.couples(id,name,start_date,timezone) values('10000000-0000-4000-8000-000000000061','Test','2024-01-01','Pacific/Kiritimati');
insert into public.memberships(couple_id,user_id,slot) values
 ('10000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000061',1),
 ('10000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062',2);
create function pg_temp.entry_write(command text,payload jsonb,actor uuid default '00000000-0000-4000-8000-000000000061',op uuid default gen_random_uuid()) returns jsonb language sql as $$
 select public.commit_mutation(actor,command,payload,op,'entry-test',now()+interval '1 day')
$$;
create temporary table saved_entry as select pg_temp.entry_write('entry.create','{"kind":"letter","title":"Gửi em 💗","content":"Tiếng Việt é 💗 <script>alert(1)</script>","event_date":"2024-02-29"}',op=>'50000000-0000-4000-8000-000000000061') result;
select is((select count(*)::integer from public.entries),1,'Entry created');
select is((select title from public.entries),'Gửi em 💗','Vietnamese and emoji preserved');
select is((select content from public.entries),'Tiếng Việt é 💗 <script>alert(1)</script>','Combining marks and hostile text stored as plain text');
select is((select count(*)::integer from public.notifications),1,'One transactional notification');
select is((select recipient_id::text from public.notifications),'00000000-0000-4000-8000-000000000062','Only partner notified');
select pg_temp.entry_write('entry.create','{"kind":"letter","title":"Gửi em 💗","content":"Tiếng Việt é 💗 <script>alert(1)</script>","event_date":"2024-02-29"}',op=>'50000000-0000-4000-8000-000000000061');
select is((select count(*)::integer from public.entries),1,'Create exact replay returns receipt');
select is((select count(*)::integer from public.notifications),1,'Replay does not renotify');
select throws_ok($$select public.commit_mutation('00000000-0000-4000-8000-000000000061','entry.create','{}','50000000-0000-4000-8000-000000000061','changed',now()+interval '1 day')$$,'P0001','OPERATION_CONFLICT','Changed receipt hash rejected');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000062',true);
select is((select count(*)::integer from public.entries),1,'Partner reads shared letters');
select ok(not public.authorize_operation_intent('entry.delete',jsonb_build_object('id',(select id from public.entries))),'Partner cannot issue mutation');
reset role;
select ok(not has_table_privilege('authenticated','public.entries','UPDATE'),'Direct member update denied');
select ok(not has_table_privilege('authenticated','public.entries','DELETE'),'Direct member delete denied');
select ok(not has_table_privilege('anon','public.entries','SELECT'),'Anonymous read denied');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000063',true);
select is((select count(*)::integer from public.entries),0,'Outsider RLS reads no content');
reset role;
select throws_ok($$select pg_temp.entry_write('entry.delete',jsonb_build_object('id',(select id from public.entries),'expected_version',1),'00000000-0000-4000-8000-000000000062')$$,'P0001','CONFLICT','Partner trusted-path delete denied');
select pg_temp.entry_write('entry.update',jsonb_build_object('id',(select id from public.entries),'expected_version',1,'kind','letter','title','Gửi em 💗','content','Tiếng Việt é 💗 <script>alert(1)</script>','event_date','2024-02-29'));
select is((select version from public.entries),1,'No-op preserves version');
select is((select count(*)::integer from public.notifications),1,'No-op emits no notification');
select pg_temp.entry_write('entry.update',jsonb_build_object('id',(select id from public.entries),'expected_version',1,'kind','diary','title','Ngày mới','content','Thương nhau','event_date','2024-03-01'));
select is((select version from public.entries),2,'Changed entry increments version');
select is((select kind from public.entries),'diary','Author can change entry type');
select throws_ok($$select pg_temp.entry_write('entry.delete',jsonb_build_object('id',(select id from public.entries),'expected_version',1))$$,'P0001','CONFLICT','Stale deletion rejected');
select throws_ok($$select pg_temp.entry_write('entry.create',jsonb_build_object('kind','diary','title','Future','content','x','event_date',(now() at time zone 'Pacific/Kiritimati')::date+1))$$,'P0001','INVALID_DATE','Future date checked in couple timezone');
select lives_ok($$select pg_temp.entry_write('entry.create',jsonb_build_object('kind','diary','title',repeat('💗',200),'content',repeat('💗',50000),'event_date',(now() at time zone 'Pacific/Kiritimati')::date))$$,'Local today and exact code-point limits accepted');
select throws_ok($$select pg_temp.entry_write('entry.create',jsonb_build_object('kind','diary','title',repeat('💗',201),'content','x','event_date','2024-01-01'))$$,'23514',null,'Overlong title rejected by database');
select throws_ok($$select pg_temp.entry_write('entry.create',jsonb_build_object('kind','diary','title','x','content',repeat('💗',50001),'event_date','2024-01-01'))$$,'23514',null,'Overlong content rejected by database');
select throws_ok($$select pg_temp.entry_write('entry.create','{"kind":"secret","title":"x","content":"x","event_date":"2024-01-01"}')$$,'23514',null,'No secret author-only type');
select throws_ok($$select pg_temp.entry_write('entry.create','{"kind":"diary","title":"x","content":" \n\t","event_date":"2024-01-01"}')$$,'23514',null,'Whitespace-only content rejected');
insert into public.entries(id,couple_id,author_id,kind,title,content,event_date,created_at) values
 ('60000000-0000-4000-8000-000000000061','10000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000061','diary','Tie A','x','2024-01-01','2024-01-01T12:00:00Z'),
 ('60000000-0000-4000-8000-000000000062','10000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062','diary','Tie B','x','2024-01-01','2024-01-01T12:00:00Z');
select is((select string_agg(title,',' order by event_date desc,created_at desc,id desc) from public.entries where title like 'Tie %'),'Tie B,Tie A','Stable chronology for equal dates/timestamps');
select is((select count(*)::integer from public.entries where event_date='2024-01-01' and created_at='2024-01-01T12:00:00Z' and id<'60000000-0000-4000-8000-000000000062'),1,'Cursor excludes equal-date returned row');
select pg_temp.entry_write('entry.delete',jsonb_build_object('id',(select result->>'id' from saved_entry),'expected_version',2),op=>'50000000-0000-4000-8000-000000000062');
select lives_ok($$select pg_temp.entry_write('entry.delete',jsonb_build_object('id',(select result->>'id' from saved_entry),'expected_version',2),op=>'50000000-0000-4000-8000-000000000062')$$,'Deletion replay returns saved receipt');
select ok(not exists(select 1 from public.entries where id=(select (result->>'id')::uuid from saved_entry)),'Deleted entry immediately inaccessible');
select * from finish();
rollback;
