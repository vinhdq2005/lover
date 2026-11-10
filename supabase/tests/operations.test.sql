begin;
-- Isolate fixtures transactionally; rollback restores existing LOCAL test data.
truncate public.couples, public.profiles, public.operation_receipts cascade;
set local search_path=public,extensions;
select plan(7);
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000011','operation@example.test');
select throws_ok($$insert into public.operation_receipts values('00000000-0000-4000-8000-000000000011',gen_random_uuid(),'test.update','hash','{}',now(),now())$$,'23514',null,'Receipt cannot be purged before expiry plus margin');
insert into public.operation_receipts values('00000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000011','test.update','hash','{}',now()+interval '30 days',now()+interval '31 days');
select throws_ok($$insert into public.operation_receipts values('00000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000011','test.update','other','{}',now()+interval '30 days',now()+interval '31 days')$$,'23505',null,'Same actor/operation cannot be reused with altered hash');
select ok(not has_table_privilege('authenticated','public.operation_receipts','INSERT'),'Browser cannot forge receipt');
select ok(not has_table_privilege('anon','public.operation_receipts','SELECT'),'Anonymous cannot read receipt');
select ok(has_function_privilege('authenticated','public.reserve_operation_issue()','EXECUTE'),'Issuance rate limit is authenticated');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
select ok((select bool_and(public.reserve_operation_issue()) from generate_series(1,30)),'Thirty issuance slots are available');
select is(public.reserve_operation_issue(),false,'Thirty-first issuance is denied in the same window');
select * from finish();rollback;
