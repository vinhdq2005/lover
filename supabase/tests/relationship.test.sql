begin;
-- Isolate fixtures transactionally; rollback restores existing LOCAL test data.
truncate public.couples, public.profiles, public.operation_receipts cascade;set local search_path=public,extensions;select plan(17);
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000001','sql-first@example.test',now()),('00000000-0000-4000-8000-000000000002','sql-partner@example.test',now());
insert into public.profiles(user_id,display_name) values('00000000-0000-4000-8000-000000000001','First'),('00000000-0000-4000-8000-000000000002','Partner');
insert into public.couples(id,name,start_date) values('10000000-0000-4000-8000-000000000001','Test','2024-01-01');
insert into public.memberships(couple_id,user_id,slot) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',1),('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',2);

select public.commit_mutation('00000000-0000-4000-8000-000000000001','couple.update','{"expected_version":1,"start_date":"2024-01-01"}',gen_random_uuid(),'hash',now()+interval '1 day');
select is((select count(*)::integer from public.notifications),0,'No-op update does not notify');
select throws_ok($$select public.commit_mutation('00000000-0000-4000-8000-000000000001','couple.update','{"expected_version":1,"start_date":"2999-01-01"}',gen_random_uuid(),'hash',now()+interval '1 day')$$,'P0001','INVALID_DATE','Future start rejected');
select public.commit_mutation('00000000-0000-4000-8000-000000000002','couple.update','{"expected_version":1,"start_date":"2024-01-02"}',gen_random_uuid(),'hash',now()+interval '1 day');
select is((select start_date::text from public.couples),'2024-01-02','Partner can update shared date');
select throws_ok($$select public.commit_mutation('00000000-0000-4000-8000-000000000001','couple.update','{"expected_version":1,"start_date":"2024-01-03"}',gen_random_uuid(),'hash',now()+interval '1 day')$$,'P0001','CONFLICT','Stale date update rejected');
-- Fixed target and operation IDs make exact replay distinguishable from a new save.
insert into public.milestones(id,couple_id,label,original_date,updated_at) values('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Leap day','2024-02-29','2024-02-29T00:00:00Z');
create temporary table baseline as select count(*)::integer events from public.change_events;
select public.commit_mutation('00000000-0000-4000-8000-000000000001','milestone.update','{"id":"40000000-0000-4000-8000-000000000001","expected_version":1,"label":"Leap day","original_date":"2024-02-29"}','50000000-0000-4000-8000-000000000001','same',now()+interval '1 day');
select is((select version from public.milestones),1,'Unchanged leap-date save preserves version');
select is((select updated_at from public.milestones),'2024-02-29T00:00:00Z'::timestamptz,'No-op preserves updated_at');
select is((select count(*)::integer from public.change_events),(select events from baseline),'No-op emits no event');
select is((select count(*)::integer from public.notifications),1,'No-op emits no extra partner notification');
select public.commit_mutation('00000000-0000-4000-8000-000000000001','milestone.update','{"id":"40000000-0000-4000-8000-000000000001","expected_version":1,"label":"Leap day","original_date":"2024-02-29"}','50000000-0000-4000-8000-000000000001','same',now()+interval '1 day');
select is((select count(*)::integer from public.operation_receipts where operation_id='50000000-0000-4000-8000-000000000001'),1,'Repeated no-op has one receipt');
select public.commit_mutation('00000000-0000-4000-8000-000000000002','milestone.update','{"id":"40000000-0000-4000-8000-000000000001","expected_version":1,"label":"Leap day","original_date":"2024-02-29"}',gen_random_uuid(),'new-save',now()+interval '1 day');
select is((select version from public.milestones),1,'Partner identical save with new operation stays no-op');
select public.commit_mutation('00000000-0000-4000-8000-000000000001','milestone.update','{"id":"40000000-0000-4000-8000-000000000001","expected_version":1,"label":"Changed","original_date":"2024-02-29"}','50000000-0000-4000-8000-000000000002','changed',now()+interval '1 day');
select public.commit_mutation('00000000-0000-4000-8000-000000000001','milestone.update','{"id":"40000000-0000-4000-8000-000000000001","expected_version":1,"label":"Changed","original_date":"2024-02-29"}','50000000-0000-4000-8000-000000000002','changed',now()+interval '1 day');
select is((select version from public.milestones),2,'Actual change plus retry increments once');
select is((select count(*)::integer from public.change_events),(select events+1 from baseline),'Actual change plus retry emits exactly once');
select throws_ok($$select public.commit_mutation('00000000-0000-4000-8000-000000000001','milestone.update','{"id":"40000000-0000-4000-8000-000000000001","expected_version":1,"label":"Changed","original_date":"2024-02-29"}',gen_random_uuid(),'stale',now()+interval '1 day')$$,'P0001','CONFLICT','Unchanged-looking stale save is still a conflict');
select throws_ok($$select public.commit_mutation('00000000-0000-4000-8000-000000000001','milestone.update','{"id":"40000000-0000-4000-8000-000000000001","expected_version":1,"label":"Changed","original_date":"2024-02-29"}','50000000-0000-4000-8000-000000000002','modified',now()+interval '1 day')$$,'P0001','OPERATION_CONFLICT','Replay with modified hash rejected');
select lives_ok(format('select public.commit_mutation(%L,%L,%L::jsonb,gen_random_uuid(),%L,now()+interval ''1 day'')','00000000-0000-4000-8000-000000000001','milestone.create',jsonb_build_object('label','Today','original_date',(now() at time zone 'Asia/Ho_Chi_Minh')::date)::text,'today'),'Couple-local today is valid');
select throws_ok(format('select public.commit_mutation(%L,%L,%L::jsonb,gen_random_uuid(),%L,now()+interval ''1 day'')','00000000-0000-4000-8000-000000000001','milestone.create',jsonb_build_object('label','Tomorrow','original_date',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1)::text,'tomorrow'),'P0001','INVALID_DATE','Couple-local tomorrow rejected');
select throws_ok($$select public.commit_mutation('00000000-0000-4000-8000-000000000001','milestone.create','{"label":"Invalid leap day","original_date":"2023-02-29"}',gen_random_uuid(),'invalid-leap',now()+interval '1 day')$$,'22008',null,'Invalid leap date rejected by database');
select * from finish();rollback;
