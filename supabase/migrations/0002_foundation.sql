create table public.operation_receipts (
 actor_id uuid not null references auth.users(id), operation_id uuid not null, command text not null,
 request_hash text not null, result_reference jsonb not null, token_expires_at timestamptz not null,
 purge_after timestamptz not null, primary key(actor_id,operation_id), check(purge_after>=token_expires_at+interval '24 hours')
);
alter table public.operation_receipts enable row level security;
revoke all on public.operation_receipts from anon,authenticated;
create table private.usage_budget (
 scope text primary key, reserved_bytes bigint not null default 0 check(reserved_bytes>=0),
 committed_bytes bigint not null default 0 check(committed_bytes>=0), email_attempts integer not null default 0 check(email_attempts>=0), day date
);
insert into private.usage_budget(scope) values('media');
create table public.change_events (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id), actor_id uuid not null references public.profiles(user_id),
 operation_id uuid not null, category text not null, action text not null, resource_id uuid,
 created_at timestamptz not null default now(), unique(actor_id,operation_id), unique(couple_id,id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null, event_id uuid not null,
 recipient_id uuid not null references public.profiles(user_id), read_at timestamptz, created_at timestamptz not null default now(),
 unique(event_id,recipient_id), foreign key(couple_id,event_id) references public.change_events(couple_id,id) on delete cascade
);
create table public.deliveries (
 id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.notifications(id) on delete cascade,
 channel text not null default 'email' check(channel='email'), state text not null default 'disabled' check(state in('disabled','pending','leased','accepted','failed','deferred_quota','unknown')),
 attempts integer not null default 0 check(attempts between 0 and 5), lease_until timestamptz, next_attempt_at timestamptz,
 provider_key uuid not null default gen_random_uuid(), provider_message_id text, error_code text,
 unique(notification_id,channel)
);
alter table public.change_events enable row level security;
alter table public.notifications enable row level security;
alter table public.deliveries enable row level security;
revoke all on public.change_events,public.notifications,public.deliveries from anon,authenticated;
grant select on public.notifications to authenticated;
create policy recipient_read on public.notifications for select to authenticated using(recipient_id=auth.uid() and private.is_member(couple_id));
create function private.emit_change(space uuid,actor uuid,op uuid,category text,action text,resource uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare event uuid; recipient uuid; notice uuid;
begin
 if not exists(select 1 from public.memberships where couple_id=space and user_id=actor) then raise exception 'ACCESS_DENIED'; end if;
 insert into public.change_events(couple_id,actor_id,operation_id,category,action,resource_id)
 values(space,actor,op,category,action,resource) returning id into event;
 select user_id into recipient from public.memberships where couple_id=space and user_id<>actor;
 if recipient is not null then
  insert into public.notifications(couple_id,event_id,recipient_id) values(space,event,recipient) returning id into notice;
  insert into public.deliveries(notification_id,state) values(notice,'disabled');
 end if;
 return event;
end $$;
revoke all on function private.emit_change(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant all on public.operation_receipts,public.change_events,public.notifications,public.deliveries to service_role;

create table private.operation_rate_limits (user_id uuid primary key references auth.users(id), window_start timestamptz not null, attempts integer not null);
create function public.authorize_operation_intent(command text,payload jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); space uuid; category text:=split_part(command,'.',1); action text:=split_part(command,'.',2); target uuid; owner_column text; table_name text; allowed boolean;
begin
 if actor is null then return false; end if;
 select couple_id into space from public.memberships where user_id=actor;
 if command='couple.create' then return space is null and not exists(select 1 from public.couples) and exists(select 1 from private.bootstrap_eligibility where first_user_id=actor and consumed_at is null); end if;
 if command='invitation.accept' then
  return exists(select 1 from public.invitations i join auth.users u on u.id=actor where i.recipient_email=lower(u.email) and u.email_confirmed_at is not null and i.state='pending' and i.expires_at>now() and i.token_hash=encode(extensions.digest(payload->>'token','sha256'),'hex'));
 end if;
 if space is null then return false; end if;
 if command in('couple.update','milestone.create','memory.create','album.create','entry.create','upload.reserve') then return true; end if;
 if command='profile.update' then return not payload ? 'user_id' or (payload->>'user_id')::uuid=actor; end if;
 if command in('invitation.create','invitation.revoke') then return exists(select 1 from public.memberships where couple_id=space and user_id=actor and slot=1); end if;
 if action not in('update','delete') then return false; end if;
 table_name:=case category when 'memory' then 'memories' when 'album' then 'albums' when 'entry' then 'entries' when 'photo' then 'photos' when 'milestone' then 'milestones' else null end;
 owner_column:=case category when 'memory' then 'creator_id' when 'album' then 'creator_id' when 'entry' then 'author_id' when 'photo' then 'uploader_id' else null end;
 if table_name is null or to_regclass('public.'||table_name) is null then return false; end if;
 target:=(payload->>'id')::uuid;
 if category='milestone' then execute format('select exists(select 1 from public.%I where id=$1 and couple_id=$2)',table_name) into allowed using target,space;
 else execute format('select exists(select 1 from public.%I where id=$1 and couple_id=$2 and %I=$3)',table_name,owner_column) into allowed using target,space,actor; end if;
 return allowed;
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.authorize_operation_intent(text,jsonb) from public,anon;
grant execute on function public.authorize_operation_intent(text,jsonb) to authenticated;
create function public.reserve_operation_issue() returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); count integer;
begin
 if actor is null then return false; end if;
 insert into private.operation_rate_limits(user_id,window_start,attempts) values(actor,now(),1)
 on conflict(user_id) do update set attempts=case when private.operation_rate_limits.window_start < now()-interval '1 minute' then 1 else private.operation_rate_limits.attempts+1 end,
 window_start=case when private.operation_rate_limits.window_start < now()-interval '1 minute' then now() else private.operation_rate_limits.window_start end returning attempts into count;
 return count<=30;
end $$;
revoke all on function public.reserve_operation_issue() from public,anon;
grant execute on function public.reserve_operation_issue() to authenticated;
