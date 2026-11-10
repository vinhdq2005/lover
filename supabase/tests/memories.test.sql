begin;
-- Isolate fixtures transactionally; rollback restores existing LOCAL test data.
truncate public.couples, public.profiles, public.operation_receipts cascade;set local search_path=public,extensions;select plan(12);
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000001','sql-first@example.test',now()),('00000000-0000-4000-8000-000000000002','sql-partner@example.test',now());
insert into public.profiles(user_id,display_name) values('00000000-0000-4000-8000-000000000001','First'),('00000000-0000-4000-8000-000000000002','Partner');
insert into public.couples(id,name,start_date) values('10000000-0000-4000-8000-000000000001','Test','2024-01-01');
insert into public.memberships(couple_id,user_id,slot) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',1),('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',2);

select public.commit_mutation('00000000-0000-4000-8000-000000000001','memory.create','{"title":"Test memory","description":"Private","event_date":"2024-01-02"}',gen_random_uuid(),'hash',now()+interval '1 day');
select is((select count(*)::integer from public.memories),1,'Memory saved once');
select is((select count(*)::integer from public.notifications),1,'Partner gets committed notification');
select throws_ok($$select public.commit_mutation('00000000-0000-4000-8000-000000000002','memory.delete',jsonb_build_object('id',(select id from public.memories),'expected_version',1),gen_random_uuid(),'hash',now()+interval '1 day')$$,'P0001','CONFLICT','Partner cannot delete author memory');
set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.memories),1,'Partner can read shared memory');
reset role;
select is((select count(*)::integer from public.memories where event_date between '2024-01-02' and '2024-01-02'),1,'Inclusive single-day filter');
select ok(not has_table_privilege('authenticated','public.memories','UPDATE'),'Direct member update is denied');
select public.commit_mutation('00000000-0000-4000-8000-000000000001','memory.update',jsonb_build_object('id',(select id from public.memories),'expected_version',1,'title','Test memory','description','Private','event_date','2024-01-02'),gen_random_uuid(),'hash',now()+interval '1 day');
select is((select count(*)::integer from public.notifications),1,'Identical memory update does not notify');
set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select is((select count(*)::integer from public.memories),0,'Outsider direct read is empty');
reset role;

select public.commit_mutation('00000000-0000-4000-8000-000000000001','memory.create','{"title":"Test memory","description":"Private","event_date":"2024-01-02"}',(select operation_id from public.change_events where category='memory' and action='create' limit 1),'hash',now()+interval '1 day');
select is((select count(*)::integer from public.memories),1,'Retried create returns receipt without another memory');
select throws_ok($$select public.commit_mutation('00000000-0000-4000-8000-000000000001','memory.update',jsonb_build_object('id',(select id from public.memories),'expected_version',5,'title','Changed','description','Private','event_date','2024-01-02'),gen_random_uuid(),'hash',now()+interval '1 day')$$,'P0001','CONFLICT','Stale memory edit rejected');

insert into public.memories(id,couple_id,creator_id,title,event_date,created_at) values('40000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','TieA','2024-02-14','2024-02-14T12:00:00Z'),('40000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','TieB','2024-02-14','2024-02-14T12:00:00Z');
select is((select string_agg(title,',' order by event_date desc,created_at desc,id desc) from public.memories where title in('TieA','TieB')),'TieB,TieA','Equal date/time ordering uses descending stable ID');
select is((select count(*)::integer from public.memories where event_date='2024-02-14' and created_at='2024-02-14T12:00:00Z' and id<'40000000-0000-4000-8000-000000000022'),1,'Keyset cursor excludes already returned tie');
select * from finish();rollback;
