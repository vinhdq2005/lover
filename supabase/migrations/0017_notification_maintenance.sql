insert into private.usage_budget(scope) values('email') on conflict do nothing;
create function public.claim_email(delivery_enabled boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.deliveries;claimed jsonb:='[]';used integer;token uuid;
begin
 perform 1 from private.usage_budget where scope='email' for update;
 update private.usage_budget set day=(now() at time zone 'UTC')::date,email_attempts=0 where scope='email' and day is distinct from (now() at time zone 'UTC')::date;
 select email_attempts into used from private.usage_budget where scope='email';
 for job in select d.* from public.deliveries d where d.attempts<5 and
  (d.state='pending' or (d.state in('failed','deferred_quota','unknown') and d.next_attempt_at<=now()) or (d.state='leased' and d.lease_until<=now())) order by d.created_at,d.id limit 20 for update skip locked loop
  if not delivery_enabled or not coalesce((select email_enabled from private.notification_config where singleton),false)
    or not exists(select 1 from public.notifications n join public.change_events e on e.id=n.event_id and e.couple_id=n.couple_id
     join public.memberships r on r.couple_id=n.couple_id and r.user_id=n.recipient_id join public.memberships a on a.couple_id=n.couple_id and a.user_id=e.actor_id
     join auth.users u on u.id=n.recipient_id join public.notification_preferences p on p.user_id=n.recipient_id
     where n.id=job.notification_id and n.recipient_id<>e.actor_id and u.email_confirmed_at is not null and p.email_enabled) then
   update public.deliveries set state='disabled',error_code='EMAIL_DISABLED',next_attempt_at=null,lease_until=null,lease_token=null where id=job.id;continue;
  end if;
  if job.first_attempt_at is not null and job.first_attempt_at<=now()-interval '30 minutes' then
   update public.deliveries set state='unknown',error_code='DEDUPE_EXPIRED',next_attempt_at=null,lease_until=null,lease_token=null where id=job.id;continue;
  end if;
  if used>=100 then
   update public.deliveries set state='deferred_quota',error_code='DAILY_QUOTA',next_attempt_at=((now() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC' where id=job.id;continue;
  end if;
  token:=gen_random_uuid();used:=used+1;
  update public.deliveries set state='leased',attempts=attempts+1,lease_until=now()+interval '2 minutes',lease_token=token,first_attempt_at=coalesce(first_attempt_at,now()),next_attempt_at=null where id=job.id;
  claimed:=claimed||jsonb_build_object('id',job.id,'lease',token,'eventKey',job.provider_key);
 end loop;
 update private.usage_budget set email_attempts=used where scope='email';
 -- A crashed final attempt is uncertain, never silently retried a sixth time.
 update public.deliveries set state='unknown',error_code='ATTEMPTS_EXHAUSTED',next_attempt_at=null,lease_token=null where state='leased' and attempts>=5 and lease_until<=now();
 return claimed;
end $$;
create function public.email_target(delivery uuid,lease uuid) returns text language sql stable security definer set search_path='' as $$
 select u.email from public.deliveries d join public.notifications n on n.id=d.notification_id join public.change_events e on e.id=n.event_id and e.couple_id=n.couple_id
 join public.memberships r on r.user_id=n.recipient_id and r.couple_id=n.couple_id join public.memberships a on a.user_id=e.actor_id and a.couple_id=n.couple_id
 join auth.users u on u.id=n.recipient_id join public.notification_preferences p on p.user_id=n.recipient_id
 where d.id=delivery and d.state='leased' and d.lease_token=lease and d.lease_until>now() and n.recipient_id<>e.actor_id and u.email_confirmed_at is not null and p.email_enabled
 and (select email_enabled from private.notification_config where singleton)
$$;
create function public.finish_email(delivery uuid,lease uuid,outcome text,provider_id text default null,retryable boolean default false,safe_code text default null) returns void
language plpgsql security definer set search_path='' as $$
declare job public.deliveries;
begin
 select * into job from public.deliveries where id=delivery and state='leased' and lease_token=lease and lease_until>now() for update;
 if not found then raise exception 'LEASE_CONFLICT';end if;
 if outcome not in('accepted','disabled','rejected','unknown') then raise exception 'INVALID_OUTCOME';end if;
 update public.deliveries set state=case when outcome='rejected' then 'failed' else outcome end,
  provider_message_id=case when outcome='accepted' then left(provider_id,500) else null end,
  error_code=case when outcome='accepted' then null when outcome='disabled' then 'EMAIL_DISABLED' when outcome='unknown' then 'UNCERTAIN' when safe_code='PROVIDER_QUOTA' then 'PROVIDER_QUOTA' else 'PROVIDER_REJECTED' end,
  lease_token=null,lease_until=null,next_attempt_at=case when job.attempts<5 and (outcome='unknown' or (outcome='rejected' and retryable)) and now()<job.first_attempt_at+interval '30 minutes' then now()+make_interval(secs=>least(900,60*(2^(job.attempts-1))::integer)) else null end
 where id=delivery;
end $$;
revoke all on function public.claim_email(boolean),public.email_target(uuid,uuid),public.finish_email(uuid,uuid,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.claim_email(boolean),public.email_target(uuid,uuid),public.finish_email(uuid,uuid,text,text,boolean,text) to service_role;

create function public.notification_maintenance() returns void language plpgsql security definer set search_path='' as $$
declare batches uuid[];
begin
 delete from public.operation_receipts where purge_after<now();
 delete from public.change_events where id in(select id from public.change_events where created_at<now()-interval '90 days' order by created_at limit 100);
 select array_agg(id) into batches from (select b.id from public.upload_batches b where b.state in('closed','expired') and coalesce(b.closed_at,b.expires_at)<now()-interval '90 days'
 and not exists(select 1 from public.upload_reservations r where r.batch_id=b.id and r.reserved_bytes>0)
 and not exists(select 1 from public.upload_files f where f.batch_id=b.id and (coalesce(f.lease_until,'epoch')>now() or f.staging_bytes>0 or (f.state<>'ready' and not f.cleanup_done))) order by b.created_at limit 100) q;
 if batches is not null then delete from public.upload_files where batch_id=any(batches);delete from public.upload_reservations where batch_id=any(batches);delete from public.upload_batches where id=any(batches);end if;
end $$;
revoke all on function public.notification_maintenance() from public,anon,authenticated;
grant execute on function public.notification_maintenance() to service_role;

create function private.capacity_state(bytes bigint) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('db_warning',bytes>=350000000,'growth_blocked',bytes>=400000000)
$$;
revoke all on function private.capacity_state(bigint) from public,anon,authenticated,service_role;
create function private.capacity_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='change_events' and to_jsonb(new)->>'action'='delete' then return new;end if;
 if (private.capacity_state(pg_database_size(current_database()))->>'growth_blocked')::boolean then raise exception 'QUOTA_EXCEEDED';end if;
 return new;
end $$;
revoke all on function private.capacity_guard() from public,anon,authenticated,service_role;
create trigger memory_growth before insert on public.memories for each row execute function private.capacity_guard();
create trigger entry_growth before insert on public.entries for each row execute function private.capacity_guard();
create trigger photo_growth before insert on public.photos for each row execute function private.capacity_guard();
create trigger album_growth before insert on public.albums for each row execute function private.capacity_guard();
create trigger milestone_growth before insert on public.milestones for each row execute function private.capacity_guard();
create trigger event_growth before insert on public.change_events for each row execute function private.capacity_guard();
create trigger batch_growth before insert on public.upload_batches for each row execute function private.capacity_guard();
create function public.resource_health() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.memberships where user_id=auth.uid()) then raise exception 'ACCESS_DENIED';end if;
 return private.capacity_state(pg_database_size(current_database()));
end $$;
revoke all on function public.resource_health() from public,anon;
grant execute on function public.resource_health() to authenticated;

create function private.signal_notification_worker() returns bigint language plpgsql security definer set search_path='' as $$
declare endpoint text;worker text;
begin
 perform public.notification_maintenance();
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='lover_edge_base_url' limit 1;
 select decrypted_secret into worker from vault.decrypted_secrets where name='lover_worker_secret' limit 1;
 if endpoint is null or worker is null then return null;end if;
 if endpoint!~'^https://[a-z0-9-]+[.]supabase[.]co/functions/v1$' then return null;end if;
 return net.http_post(url=>endpoint||'/notification-worker',headers=>jsonb_build_object('content-type','application/json','x-worker-secret',worker),body=>'{}'::jsonb);
end $$;
revoke all on function private.signal_notification_worker() from public,anon,authenticated,service_role;
select cron.schedule('lover-notification-recovery','* * * * *','select private.signal_notification_worker()');
