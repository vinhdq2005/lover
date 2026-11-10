create table public.entries (
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id),
 author_id uuid not null references public.profiles(user_id),
 kind text not null check(kind in ('diary','letter')),
 title text not null check(char_length(title) between 1 and 200 and title !~ '^[[:space:]]*$'),
 content text not null check(char_length(content) between 1 and 50000 and content !~ '^[[:space:]]*$'),
 event_date date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version integer not null default 1 check(version>0), unique(couple_id,id)
);
create index entries_chronology on public.entries(couple_id,event_date desc,created_at desc,id desc);
alter table public.entries enable row level security;
revoke all on public.entries from public,anon,authenticated;
grant select on public.entries to authenticated;
grant all on public.entries to service_role;
create policy entries_member_read on public.entries for select to authenticated using(private.is_member(couple_id));

-- Preserve the verified relationship/media commands behind the same trusted RPC.
alter function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) set schema private;
alter function private.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) rename to commit_before_entries;
revoke all on function private.commit_before_entries(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated,service_role;

create function public.commit_mutation(actor uuid,command text,payload jsonb,op uuid,request_hash text,token_expiry timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare space uuid;zone text;receipt public.operation_receipts;old_entry public.entries;
 target uuid;result jsonb;unchanged boolean:=false;action text:=split_part(command,'.',2);
begin
 if split_part(command,'.',1)<>'entry' then
  return private.commit_before_entries(actor,command,payload,op,request_hash,token_expiry);
 end if;
 if actor is null or token_expiry<=now() or token_expiry>now()+interval '30 days 1 minute' then raise exception 'INVALID_OPERATION';end if;
 if command not in ('entry.create','entry.update','entry.delete') then raise exception 'INVALID_COMMAND';end if;
 select couple_id into space from public.memberships where user_id=actor;
 if space is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into receipt from public.operation_receipts where actor_id=actor and operation_id=op;
 if found then
  if receipt.command<>command or receipt.request_hash<>request_hash then raise exception 'OPERATION_CONFLICT';end if;
  return receipt.result_reference;
 end if;
 select timezone into zone from public.couples where id=space for update;
 if action<>'delete' then
  if payload->>'event_date' is null or (payload->>'event_date')::date>(now() at time zone zone)::date then raise exception 'INVALID_DATE';end if;
 end if;
 if action='create' then
  insert into public.entries(couple_id,author_id,kind,title,content,event_date)
  values(space,actor,payload->>'kind',payload->>'title',payload->>'content',(payload->>'event_date')::date) returning id into target;
 else
  select * into old_entry from public.entries where id=(payload->>'id')::uuid and couple_id=space and author_id=actor for update;
  if not found or (payload->>'expected_version')::integer is distinct from old_entry.version then raise exception 'CONFLICT';end if;
  target:=old_entry.id;
  if action='update' then
   unchanged:=old_entry.kind=payload->>'kind' and old_entry.title=payload->>'title' and old_entry.content=payload->>'content' and old_entry.event_date=(payload->>'event_date')::date;
   if not unchanged then
    update public.entries set kind=payload->>'kind',title=payload->>'title',content=payload->>'content',event_date=(payload->>'event_date')::date,updated_at=now(),version=version+1 where id=target;
   end if;
  else delete from public.entries where id=target;end if;
 end if;
 if not unchanged then perform private.emit_change(space,actor,op,'entry',action,target);end if;
 result:=jsonb_build_object('id',target);
 insert into public.operation_receipts values(actor,op,command,request_hash,result,token_expiry,token_expiry+interval '24 hours');
 return result;
end $$;
revoke all on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) to service_role;
