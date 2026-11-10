begin;
-- Isolate fixtures transactionally; rollback restores existing LOCAL test data.
truncate public.couples, public.profiles, public.operation_receipts cascade;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(12);
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','sql-first@example.test'),
 ('00000000-0000-4000-8000-000000000002','sql-partner@example.test'),
 ('00000000-0000-4000-8000-000000000003','sql-outsider@example.test');
insert into public.profiles(user_id,display_name) values
 ('00000000-0000-4000-8000-000000000001','First'),('00000000-0000-4000-8000-000000000002','Partner');
insert into public.couples(id,name,start_date) values('10000000-0000-4000-8000-000000000001','Test couple','2024-01-01');
insert into public.memberships(couple_id,user_id,slot) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',1);
select private.emit_change('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','test','create',null);
select is((select count(*)::integer from public.notifications),0,'No partner means no notification');
insert into public.memberships(couple_id,user_id,slot) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',2);
savepoint emission;
select private.emit_change('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','test','update',null);
rollback to emission;
select is((select count(*)::integer from public.notifications),0,'Rollback cannot leave a notification');
select private.emit_change('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','test','update',null);
select is((select count(*)::integer from public.notifications),1,'Only partner gets a notification');
select is((select count(*)::integer from public.notifications where recipient_id='00000000-0000-4000-8000-000000000001'),0,'Actor gets none');
select is((select state from public.deliveries),'disabled','Mail fails closed');
select ok(not has_table_privilege('authenticated','public.memberships','INSERT'),'No membership self-grant');
select ok(not has_table_privilege('authenticated','public.operation_receipts','SELECT'),'Receipts not browser readable');
select ok(not has_function_privilege('authenticated','private.emit_change(uuid,uuid,uuid,text,text,uuid)','EXECUTE'),'Browser cannot forge events');
select throws_ok($$select private.emit_change('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','test','update',null)$$,'23505',null,'Duplicate operation cannot emit again');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select is((select count(*)::integer from public.couples),0,'Outsider sees no couple');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.couples),1,'Partner reads couple');
select is((select count(*)::integer from public.notifications),1,'Recipient reads own notice');
reset role;
select * from finish();
rollback;
