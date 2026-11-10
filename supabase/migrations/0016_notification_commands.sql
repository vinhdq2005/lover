create table public.notification_preferences (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 email_enabled boolean not null default false,version integer not null default 1 check(version>0)
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
create policy own_notification_preferences on public.notification_preferences for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.memberships where user_id=auth.uid()));
create table private.notification_config(singleton boolean primary key default true check(singleton),email_enabled boolean not null default false);
insert into private.notification_config values(true,false);
revoke all on private.notification_config from public,anon,authenticated;
alter table public.deliveries add column created_at timestamptz not null default now(),add column first_attempt_at timestamptz,add column lease_token uuid;
create index delivery_due on public.deliveries(state,next_attempt_at);
create index inbox_recipient_order on public.notifications(recipient_id,created_at desc,id desc);
create or replace function private.emit_change(space uuid,actor uuid,op uuid,category text,action text,resource uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare event uuid;recipient uuid;notice uuid;enabled boolean;
begin
 if not exists(select 1 from public.memberships where couple_id=space and user_id=actor) then raise exception 'ACCESS_DENIED';end if;
 insert into public.change_events(couple_id,actor_id,operation_id,category,action,resource_id) values(space,actor,op,category,action,resource) returning id into event;
 select m.user_id into recipient from public.memberships m where m.couple_id=space and m.user_id<>actor;
 if recipient is not null then
  insert into public.notifications(couple_id,event_id,recipient_id) values(space,event,recipient) returning id into notice;
  enabled:=coalesce((select email_enabled from private.notification_config where singleton),false) and coalesce((select email_enabled from public.notification_preferences where user_id=recipient),false);
  insert into public.deliveries(notification_id,state,error_code) values(notice,case when enabled then 'pending' else 'disabled' end,case when enabled then null else 'EMAIL_DISABLED' end);
 end if;
 return event;
end $$;
create function private.validate_notification_recipient() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.change_events e join public.memberships m on m.couple_id=e.couple_id and m.user_id=new.recipient_id where e.id=new.event_id and e.couple_id=new.couple_id and e.actor_id<>new.recipient_id) then raise exception 'ACCESS_DENIED';end if;
 return new;
end $$;
create trigger notification_recipient_guard before insert on public.notifications for each row execute function private.validate_notification_recipient();
revoke all on function private.validate_notification_recipient() from public,anon,authenticated,service_role;

create function public.notification_inbox(page_size integer default 30,before_time timestamptz default null,before_id uuid default null,target uuid default null)
returns table(id uuid,actor_id uuid,actor_name text,category text,action text,created_at timestamptz,read_at timestamptz,delivery_state text,retry_allowed boolean,upload_summary jsonb)
language sql stable security definer set search_path='' as $$
 select n.id,e.actor_id,p.display_name,e.category,e.action,n.created_at,n.read_at,coalesce(d.state,'disabled'),
 coalesce(d.state='failed' and d.attempts<5 and d.next_attempt_at<=now(),false),
 case when b.id is not null then jsonb_build_object('batch_id',b.id,'success_count',b.success_count,'failure_count',b.failure_count,'status',b.state) else null end
 from public.notifications n join public.change_events e on e.id=n.event_id and e.couple_id=n.couple_id
 join public.profiles p on p.user_id=e.actor_id left join public.deliveries d on d.notification_id=n.id
 left join public.upload_batches b on e.category='upload' and b.id=e.resource_id and b.event_id=e.id and b.couple_id=n.couple_id and b.recipient_id=n.recipient_id
 where n.recipient_id=auth.uid() and e.actor_id<>auth.uid() and private.is_member(n.couple_id)
 and (target is null or n.id=target) and (before_time is null or (n.created_at,n.id)<(before_time,before_id))
 order by n.created_at desc,n.id desc limit greatest(1,least(50,page_size))
$$;
revoke all on function public.notification_inbox(integer,timestamptz,uuid,uuid) from public,anon;
grant execute on function public.notification_inbox(integer,timestamptz,uuid,uuid) to authenticated;

alter function public.authorize_operation_intent(text,jsonb) set schema private;
alter function private.authorize_operation_intent(text,jsonb) rename to authorize_before_notifications;
revoke all on function private.authorize_before_notifications(text,jsonb) from public,anon,authenticated,service_role;
create function public.authorize_operation_intent(command text,payload jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if split_part(command,'.',1)<>'notification' then return private.authorize_before_notifications(command,payload);end if;
 if auth.uid() is null or not exists(select 1 from public.memberships where user_id=auth.uid()) then return false;end if;
 if command='notification.preferences' then return true;end if;
 if command in('notification.mark_read','notification.retry_email') then return exists(select 1 from public.notifications where id=(payload->>'notification_id')::uuid and recipient_id=auth.uid() and private.is_member(couple_id));end if;
 return false;
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.authorize_operation_intent(text,jsonb) from public,anon;
grant execute on function public.authorize_operation_intent(text,jsonb) to authenticated;

alter function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) set schema private;
alter function private.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) rename to commit_before_notifications;
revoke all on function private.commit_before_notifications(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated,service_role;
create function public.commit_mutation(actor uuid,command text,payload jsonb,op uuid,request_hash text,token_expiry timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt public.operation_receipts;target uuid;current_version integer;result jsonb;
begin
 if split_part(command,'.',1)<>'notification' then return private.commit_before_notifications(actor,command,payload,op,request_hash,token_expiry);end if;
 if token_expiry<=now() or token_expiry>now()+interval '30 days 1 minute' then raise exception 'INVALID_OPERATION';end if;
 if not exists(select 1 from public.memberships where user_id=actor) then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into receipt from public.operation_receipts where actor_id=actor and operation_id=op;
 if found then if receipt.command<>command or receipt.request_hash<>request_hash then raise exception 'OPERATION_CONFLICT';end if;return receipt.result_reference;end if;
 if command='notification.preferences' then
  select version into current_version from public.notification_preferences where user_id=actor for update;
  if coalesce(current_version,0) is distinct from (payload->>'expected_version')::integer then raise exception 'CONFLICT';end if;
  insert into public.notification_preferences(user_id,email_enabled) values(actor,(payload->>'email_enabled')::boolean)
  on conflict(user_id) do update set email_enabled=excluded.email_enabled,version=public.notification_preferences.version+case when public.notification_preferences.email_enabled<>excluded.email_enabled then 1 else 0 end;
  target:=actor;
 else
  target:=(payload->>'notification_id')::uuid;
  perform n.id from public.notifications n join public.memberships m on m.couple_id=n.couple_id and m.user_id=actor where n.id=target and n.recipient_id=actor for update of n;
  if not found then raise exception 'ACCESS_DENIED';end if;
  if command='notification.mark_read' then update public.notifications set read_at=coalesce(read_at,now()) where id=target and recipient_id=actor;
  elsif command='notification.retry_email' then
   update public.deliveries set state='pending' where notification_id=target and state='failed' and attempts<5 and next_attempt_at<=now();
   if not found then raise exception 'INVALID_DELIVERY';end if;
  else raise exception 'INVALID_COMMAND';end if;
 end if;
 result:=jsonb_build_object('id',target);
 insert into public.operation_receipts values(actor,op,command,request_hash,result,token_expiry,token_expiry+interval '24 hours');return result;
end $$;
revoke all on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) to service_role;
