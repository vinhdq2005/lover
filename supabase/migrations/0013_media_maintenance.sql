alter table public.upload_files add column cleanup_done boolean not null default false;
alter table public.photos add column storage_checked_at timestamptz not null default 'epoch',add column storage_missing boolean not null default false;
create index expired_upload_batches on public.upload_batches(expires_at) where state='open';
create index unchecked_photos on public.photos(storage_checked_at) where state='ready';
create table private.media_maintenance_lease(singleton boolean primary key default true check(singleton),lease_id uuid,lease_until timestamptz not null default 'epoch');
insert into private.media_maintenance_lease(singleton) values(true);
revoke all on private.media_maintenance_lease from public,anon,authenticated;
create function public.begin_media_maintenance() returns uuid language plpgsql security definer set search_path='' as $$
declare claim uuid:=gen_random_uuid();result uuid;
begin
 update private.media_maintenance_lease set lease_id=claim,lease_until=now()+interval '5 minutes' where singleton and lease_until<=now() returning lease_id into result;return result;
end $$;
create function private.require_media_lease(lease uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from private.media_maintenance_lease where singleton and lease_id=lease and lease_until>now() for update;
 if not found then raise exception 'ACCESS_DENIED';end if;
end $$;
create function public.end_media_maintenance(lease uuid) returns void language sql security definer set search_path='' as $$
 update private.media_maintenance_lease set lease_until=now() where singleton and lease_id=lease
$$;
create function public.media_cleanup_candidates(lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_media_lease(lease);
 with expired as(select id from public.upload_batches where state='open' and expires_at<=now() order by expires_at limit 20 for update skip locked)
 update public.upload_batches set state='expired',closed_at=expires_at where id in(select id from expired);
 update public.upload_reservations r set state='expired' where r.state='open' and r.batch_id in(select id from public.upload_batches where state='expired');
 select coalesce(jsonb_agg(to_jsonb(j)-'priority'),'[]') into result from (
  select 'photo'::text kind,p.id,array_remove(array[p.storage_path,p.preview_path],null) paths,1 priority from public.photos p where p.state='deleting'
  union all
  select 'staging',f.file_id,array[f.staging_path],2 from public.upload_files f where f.state='ready' and f.staging_bytes>0
  union all
  select 'unpublished',f.file_id,array[f.staging_path,f.media_path],3 from public.upload_files f join public.upload_batches b on b.id=f.batch_id
    where not f.cleanup_done and f.state<>'ready' and b.state in('closed','expired') and coalesce(b.closed_at,b.expires_at)<now()-interval '3 minutes' and coalesce(f.lease_until,'epoch')<now()
  union all
  select 'reconcile',p.id,array[p.storage_path],4 from public.photos p where p.state='ready' and p.storage_checked_at<now()-interval '1 day'
  order by priority,id limit 20
 ) j;
 return result;
end $$;
create function public.confirm_media_cleanup(lease uuid,kind text,target uuid) returns void language plpgsql security definer set search_path='' as $$
declare f public.upload_files;p public.photos;b public.upload_batches;cost bigint;
begin
 perform private.require_media_lease(lease);
 if kind='photo' then
  select * into p from public.photos where id=target and state='deleting' for update;if not found then return;end if;
  update private.usage_budget set committed_bytes=committed_bytes-p.bytes where scope='media';
  update public.photos set state='deleted',description='',event_date='1970-01-01',updated_at=now() where id=target;
 elsif kind in('staging','unpublished') then
  select * into f from public.upload_files where file_id=target for update;if not found then return;end if;
  if kind='staging' then
   if f.state<>'ready' or f.staging_bytes=0 then return;end if;
   update private.usage_budget set committed_bytes=committed_bytes-f.staging_bytes where scope='media';
   update public.upload_files set staging_bytes=0 where file_id=target;
  else
   select * into b from public.upload_batches where id=f.batch_id;
   if f.cleanup_done or f.state='ready' or b.state='open' or coalesce(b.closed_at,b.expires_at)>=now()-interval '3 minutes' or coalesce(f.lease_until,'epoch')>=now() then raise exception 'CLEANUP_CONFLICT';end if;
   cost:=f.declared_bytes+10485760;
   update private.usage_budget set reserved_bytes=reserved_bytes-cost where scope='media';
   update public.upload_reservations set reserved_bytes=reserved_bytes-cost where batch_id=f.batch_id;
   update public.upload_files set cleanup_done=true,state='failed',error_code='EXPIRED',lease_id=null,lease_until=null where file_id=target;
  end if;
 else raise exception 'INVALID_CLEANUP';end if;
end $$;
create function public.confirm_media_reconciliation(lease uuid,photo uuid,missing boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_media_lease(lease);
 -- A missing object is recoverable: never erase saved metadata or release its budget automatically.
 update public.photos set storage_checked_at=now(),storage_missing=missing where id=photo and state='ready';
end $$;
revoke all on function private.require_media_lease(uuid) from public,anon,authenticated,service_role;
revoke all on function public.begin_media_maintenance(),public.end_media_maintenance(uuid),public.media_cleanup_candidates(uuid),public.confirm_media_cleanup(uuid,text,uuid),public.confirm_media_reconciliation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.begin_media_maintenance(),public.end_media_maintenance(uuid),public.media_cleanup_candidates(uuid),public.confirm_media_cleanup(uuid,text,uuid),public.confirm_media_reconciliation(uuid,uuid,boolean) to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
create function private.signal_media_maintenance() returns bigint language plpgsql security definer set search_path='' as $$
declare endpoint text;worker text;request_id bigint;
begin
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='lover_edge_base_url' limit 1;
 select decrypted_secret into worker from vault.decrypted_secrets where name='lover_worker_secret' limit 1;
 if endpoint is null or worker is null then return null;end if;
 if endpoint!~'^https://[a-z0-9-]+[.]supabase[.]co/functions/v1$' then raise exception 'INVALID_WORKER_ENDPOINT';end if;
 select net.http_post(url:=endpoint||'/maintenance',headers:=jsonb_build_object('Content-Type','application/json','x-worker-secret',worker),body:='{}'::jsonb,timeout_milliseconds:=5000) into request_id;
 return request_id;
end $$;
revoke all on function private.signal_media_maintenance() from public,anon,authenticated,service_role;
select cron.schedule('lover-media-maintenance','* * * * *','select private.signal_media_maintenance()');
