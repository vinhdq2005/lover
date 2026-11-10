create table public.milestones (
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id),label text not null check(char_length(btrim(label)) between 1 and 200),original_date date not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,unique(couple_id,id)
);
alter table public.milestones enable row level security;
revoke all on public.milestones from anon,authenticated;
grant select on public.milestones to authenticated;
grant all on public.milestones to service_role;
create policy milestone_read on public.milestones for select to authenticated using(private.is_member(couple_id));
create or replace function public.commit_mutation(actor uuid,command text,payload jsonb,op uuid,request_hash text,token_expiry timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare space uuid; receipt public.operation_receipts; category text:=split_part(command,'.',1); action text:=split_part(command,'.',2); target uuid; result jsonb; settings public.couples; found_row jsonb; zone text; start_day date; meeting_day date; count integer; unchanged boolean:=false;
begin
 if actor is null or token_expiry<=now() or token_expiry>now()+interval '30 days 1 minute' then raise exception 'INVALID_OPERATION';end if;
 select couple_id into space from public.memberships where user_id=actor;if space is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into receipt from public.operation_receipts where actor_id=actor and operation_id=op;
 if found then if receipt.command<>command or receipt.request_hash<>request_hash then raise exception 'OPERATION_CONFLICT';end if;return receipt.result_reference;end if;
 select * into settings from public.couples where id=space for update;
 zone:=coalesce(payload->>'timezone',settings.timezone);
 if not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'INVALID_DATE';end if;
 if command='couple.update' then
  if settings.version<>(payload->>'expected_version')::integer then raise exception 'CONFLICT';end if;
  start_day:=coalesce((payload->>'start_date')::date,settings.start_date);
  meeting_day:=case when payload ? 'first_meeting_date' then (payload->>'first_meeting_date')::date else settings.first_meeting_date end;
  if start_day>(now() at time zone zone)::date or meeting_day>start_day then raise exception 'INVALID_DATE';end if;
  if (payload-'expected_version'-'id') <@ to_jsonb(settings) then unchanged:=true; end if;
  if not unchanged then update public.couples set name=coalesce(payload->>'name',name),start_date=start_day,first_meeting_date=meeting_day,timezone=zone,version=version+1,updated_at=now() where id=space; end if;
  target:=space;
 elsif category='milestone' then
  if action<>'delete' and (payload->>'original_date')::date>(now() at time zone zone)::date then raise exception 'INVALID_DATE';end if;
  if action='create' then insert into public.milestones(couple_id,label,original_date) values(space,payload->>'label',(payload->>'original_date')::date) returning id into target;
  elsif action='update' then
   select to_jsonb(m) into found_row from public.milestones m where id=(payload->>'id')::uuid and couple_id=space and version=(payload->>'expected_version')::integer for update;
   if found_row is not null and (payload-'id'-'expected_version') <@ found_row then
    unchanged:=true;target:=(payload->>'id')::uuid;
   else
    update public.milestones set label=payload->>'label',original_date=(payload->>'original_date')::date,updated_at=now(),version=version+1 where id=(payload->>'id')::uuid and couple_id=space and version=(payload->>'expected_version')::integer returning id into target;
   end if;
  elsif action='delete' then delete from public.milestones where id=(payload->>'id')::uuid and couple_id=space and version=(payload->>'expected_version')::integer returning id into target;end if;
 elsif category='memory' then
  if action<>'delete' and (payload->>'event_date')::date>(now() at time zone zone)::date then raise exception 'INVALID_DATE';end if;
  if action='create' then insert into public.memories(couple_id,creator_id,title,description,event_date) values(space,actor,payload->>'title',payload->>'description',(payload->>'event_date')::date) returning id into target;
  elsif action='update' then
   select to_jsonb(m) into found_row from public.memories m where id=(payload->>'id')::uuid and couple_id=space and creator_id=actor and version=(payload->>'expected_version')::integer;
   if found_row is not null and (payload-'id'-'expected_version'-'photo_ids') <@ found_row then unchanged:=true;target:=(payload->>'id')::uuid;
   else update public.memories set title=payload->>'title',description=payload->>'description',event_date=(payload->>'event_date')::date,updated_at=now(),version=version+1 where id=(payload->>'id')::uuid and couple_id=space and creator_id=actor and version=(payload->>'expected_version')::integer returning id into target;end if;
  elsif action='delete' then delete from public.memories where id=(payload->>'id')::uuid and couple_id=space and creator_id=actor and version=(payload->>'expected_version')::integer returning id into target;end if;
 else raise exception 'INVALID_COMMAND';end if;
 if target is null then raise exception 'CONFLICT';end if;
 if not unchanged then perform private.emit_change(space,actor,op,category,action,target);end if;
 result:=jsonb_build_object('id',target);
 insert into public.operation_receipts(actor_id,operation_id,command,request_hash,result_reference,token_expires_at,purge_after) values(actor,op,command,request_hash,result,token_expiry,token_expiry+interval '24 hours');
 return result;
end $$;
revoke all on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) to service_role;
