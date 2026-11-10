create table public.upload_batches (
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id),owner_id uuid not null references public.profiles(user_id),
 state text not null default 'open' check(state in('open','closed','expired')),
 expires_at timestamptz not null default now()+interval '1 hour',created_at timestamptz not null default now(),closed_at timestamptz,
 event_id uuid unique,recipient_id uuid references public.profiles(user_id),success_count integer not null default 0,failure_count integer not null default 0,
 unique(couple_id,id),foreign key(couple_id,event_id) references public.change_events(couple_id,id) on delete set null (event_id)
);
create table public.upload_reservations (
 id uuid primary key default gen_random_uuid(),batch_id uuid not null unique,couple_id uuid not null,owner_id uuid not null references public.profiles(user_id),
 operation_id uuid not null,reserved_bytes bigint not null check(reserved_bytes>=0),expires_at timestamptz not null,
 state text not null default 'open' check(state in('open','closed','expired')),
 foreign key(couple_id,batch_id) references public.upload_batches(couple_id,id)
);
create table public.upload_files (
 file_id uuid primary key default gen_random_uuid(),batch_id uuid not null references public.upload_batches(id),client_file_id uuid not null,
 declared_bytes bigint not null check(declared_bytes between 1 and 10485760),declared_type text not null check(declared_type in('image/jpeg','image/png','image/webp')),
 staging_path text not null unique,media_path text not null unique,request_hash text,
 state text not null default 'pending' check(state in('pending','processing','failed','ready')),
 lease_id uuid,lease_until timestamptz,photo_id uuid references public.photos(id),staging_bytes bigint not null default 0,
 error_code text,unique(batch_id,file_id),unique(batch_id,client_file_id),
 check((state='ready')=(photo_id is not null))
);
alter table public.upload_batches enable row level security;
alter table public.upload_reservations enable row level security;
alter table public.upload_files enable row level security;
revoke all on public.upload_batches,public.upload_reservations,public.upload_files from anon,authenticated;
grant all on public.upload_batches,public.upload_reservations,public.upload_files to service_role;

-- All staging, publication headroom and saved objects share one locked capacity row.
create function public.reserve_upload(actor uuid,payload jsonb,op uuid,request_hash text,token_expiry timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare space uuid; receipt public.operation_receipts; batch uuid; reservation uuid; f jsonb; fid uuid; need bigint; used bigint; result jsonb; files jsonb:='[]';
begin
 if token_expiry<=now() or token_expiry>now()+interval '30 days 1 minute' then raise exception 'INVALID_OPERATION';end if;
 select couple_id into space from public.memberships where user_id=actor;if space is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into receipt from public.operation_receipts where actor_id=actor and operation_id=op;
 if found then if receipt.command<>'upload.reserve' or receipt.request_hash<>request_hash then raise exception 'OPERATION_CONFLICT';end if;return receipt.result_reference;end if;
 if jsonb_typeof(payload->'files')<>'array' or jsonb_array_length(payload->'files') not between 1 and 20 then raise exception 'INVALID_FILES';end if;
 if exists(select 1 from jsonb_array_elements(payload->'files') x where (x->>'size')::bigint not between 1 and 10485760 or x->>'declared_type' not in('image/jpeg','image/png','image/webp') or x->>'client_file_id' is null) then raise exception 'INVALID_FILES';end if;
 if (select count(distinct x->>'client_file_id') from jsonb_array_elements(payload->'files') x)<>jsonb_array_length(payload->'files') then raise exception 'INVALID_FILES';end if;
 select sum((x->>'size')::bigint+10485760) into need from jsonb_array_elements(payload->'files') x;
 select reserved_bytes+committed_bytes into used from private.usage_budget where scope='media' for update;
 if used+need>838860800 then raise exception 'QUOTA_EXCEEDED';end if;
 insert into public.upload_batches(couple_id,owner_id) values(space,actor) returning id into batch;
 insert into public.upload_reservations(batch_id,couple_id,owner_id,operation_id,reserved_bytes,expires_at) values(batch,space,actor,op,need,now()+interval '1 hour') returning id into reservation;
 for f in select value from jsonb_array_elements(payload->'files') loop
  fid:=gen_random_uuid();
  insert into public.upload_files(file_id,batch_id,client_file_id,declared_bytes,declared_type,staging_path,media_path)
   values(fid,batch,(f->>'client_file_id')::uuid,(f->>'size')::bigint,f->>'declared_type',actor::text||'/'||batch::text||'/'||fid::text,space::text||'/'||fid::text||'.jpg');
  files:=files||jsonb_build_object('file_id',fid,'client_file_id',f->>'client_file_id','path',actor::text||'/'||batch::text||'/'||fid::text);
 end loop;
 update private.usage_budget set reserved_bytes=reserved_bytes+need where scope='media';
 result:=jsonb_build_object('batch_id',batch,'reservation_id',reservation,'files',files,'expires_at',now()+interval '1 hour');
 insert into public.operation_receipts values(actor,op,'upload.reserve',request_hash,result,token_expiry,token_expiry+interval '24 hours');
 return result;
end $$;
revoke all on function public.reserve_upload(uuid,jsonb,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reserve_upload(uuid,jsonb,uuid,text,timestamptz) to service_role;

create function private.can_stage(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.upload_files f join public.upload_batches b on b.id=f.batch_id join public.upload_reservations r on r.batch_id=b.id
 where f.staging_path=path and f.state in('pending','failed') and b.owner_id=auth.uid() and b.state='open' and b.expires_at>now() and r.state='open' and r.expires_at>now() and private.is_member(b.couple_id))
$$;
create function private.can_read_media(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.photos p where p.state='ready' and (p.storage_path=path or p.preview_path=path) and private.is_member(p.couple_id))
$$;
revoke all on function private.can_stage(text),private.can_read_media(text) from public,anon;
grant execute on function private.can_stage(text),private.can_read_media(text) to authenticated;

-- Owner status is narrow; raw batches/files never become an inbox or browser read surface.
create function public.upload_status(batch uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.upload_batches;result jsonb;
begin
 select * into b from public.upload_batches where id=batch and owner_id=auth.uid() and private.is_member(couple_id);
 if not found then return null;end if;
 select jsonb_build_object('batch_id',b.id,'state',b.state,'expires_at',b.expires_at,'success_count',b.success_count,'failure_count',b.failure_count,'files',coalesce(jsonb_agg(jsonb_build_object('file_id',f.file_id,'client_file_id',f.client_file_id,'state',f.state,'photo_id',f.photo_id,'error_code',f.error_code)),'[]')) into result from public.upload_files f where f.batch_id=b.id;
 return result;
end $$;
revoke all on function public.upload_status(uuid) from public,anon;
grant execute on function public.upload_status(uuid) to authenticated;


-- Finalization: narrowly granted routines; only the authenticated Edge handler calls these.
-- Wrap the existing content authorizer without weakening its enrollment/ownership checks.
alter function public.authorize_operation_intent(text,jsonb) set schema private;
alter function private.authorize_operation_intent(text,jsonb) rename to authorize_content_intent;
revoke all on function private.authorize_content_intent(text,jsonb) from public,anon,authenticated;
create function public.authorize_operation_intent(command text,payload jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); b public.upload_batches;
begin
 if command not in('upload.finalize','upload.close') then return private.authorize_content_intent(command,payload);end if;
 select * into b from public.upload_batches where id=(payload->>'batch_id')::uuid and owner_id=actor;
 if not found or not private.is_member(b.couple_id) then return false;end if;
 if command='upload.close' then return true;end if;
 return jsonb_array_length(payload->'file_ids')=1 and exists(select 1 from public.upload_reservations r where r.id=(payload->>'reservation_id')::uuid and r.batch_id=b.id and r.owner_id=actor)
  and exists(select 1 from public.upload_files f where f.file_id=(payload->'file_ids'->>0)::uuid and f.batch_id=b.id);
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.authorize_operation_intent(text,jsonb) from public,anon;
grant execute on function public.authorize_operation_intent(text,jsonb) to authenticated;

create function public.claim_upload_file(actor uuid,batch uuid,reservation uuid,file uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.upload_batches;f public.upload_files;claim uuid;
begin
 select * into b from public.upload_batches where id=batch and owner_id=actor for update;
 if not found or not exists(select 1 from public.memberships where user_id=actor and couple_id=b.couple_id) then raise exception 'ACCESS_DENIED';end if;
 if not exists(select 1 from public.upload_reservations where id=reservation and batch_id=batch and owner_id=actor) then raise exception 'ACCESS_DENIED';end if;
 select * into f from public.upload_files where file_id=file and batch_id=batch for update;
 if not found then raise exception 'ACCESS_DENIED';end if;
 if f.state='ready' then return jsonb_build_object('state','ready','photo_id',f.photo_id);end if;
 if b.state<>'open' or b.expires_at<=now() or not exists(select 1 from public.upload_reservations where id=reservation and state='open' and expires_at>now()) then raise exception 'UPLOAD_CLOSED_CONFLICT';end if;
 if f.state='processing' and f.lease_until>now() then raise exception 'UPLOAD_BUSY_CONFLICT';end if;
 claim:=gen_random_uuid();
 -- Longer than the Free worker wall-clock limit: a dead worker cannot reclaim a new lease.
 update public.upload_files set state='processing',lease_id=claim,lease_until=now()+interval '3 minutes',error_code=null where file_id=file;
 return jsonb_build_object('state','processing','lease_id',claim,'staging_path',f.staging_path,'media_path',f.media_path,'declared_bytes',f.declared_bytes,'declared_type',f.declared_type);
end $$;

create function public.publish_upload_file(actor uuid,batch uuid,reservation uuid,file uuid,claim uuid,output_bytes bigint,image_width integer,image_height integer,source_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.upload_batches;f public.upload_files;cost bigint;event uuid;recipient uuid;zone text;
begin
 select * into b from public.upload_batches where id=batch and owner_id=actor for update;
 if not found or not exists(select 1 from public.memberships where user_id=actor and couple_id=b.couple_id) then raise exception 'ACCESS_DENIED';end if;
 select * into f from public.upload_files where file_id=file and batch_id=batch for update;
 if not found then raise exception 'ACCESS_DENIED';end if;
 if f.state='ready' then if f.request_hash<>source_hash then raise exception 'UPLOAD_CONFLICT';end if;return f.photo_id;end if;
 if b.state<>'open' or b.expires_at<=now() or f.state<>'processing' or f.lease_id is distinct from claim or f.lease_until<=now() then raise exception 'UPLOAD_CONFLICT';end if;
 if not exists(select 1 from public.upload_reservations where id=reservation and batch_id=batch and owner_id=actor and state='open' and expires_at>now()) then raise exception 'UPLOAD_CONFLICT';end if;
 if output_bytes not between 1 and 10485760 or image_width not between 1 and 1600 or image_height not between 1 and 1600 or source_hash!~'^[0-9a-f]{64}$' then raise exception 'INVALID_IMAGE';end if;
 cost:=f.declared_bytes+10485760;
 perform 1 from private.usage_budget where scope='media' for update;
 update private.usage_budget set reserved_bytes=reserved_bytes-cost,committed_bytes=committed_bytes+f.declared_bytes+output_bytes where scope='media' and reserved_bytes>=cost;
 if not found then raise exception 'QUOTA_CONFLICT';end if;
 update public.upload_reservations set reserved_bytes=reserved_bytes-cost where id=reservation and reserved_bytes>=cost;
 if not found then raise exception 'QUOTA_CONFLICT';end if;
 select timezone into zone from public.couples where id=b.couple_id;
 insert into public.photos(id,couple_id,uploader_id,storage_path,event_date,bytes,format,width,height) values(f.file_id,b.couple_id,actor,f.media_path,(now() at time zone zone)::date,output_bytes,'image/jpeg',image_width,image_height);
 update public.upload_files set state='ready',photo_id=file,request_hash=source_hash,staging_bytes=f.declared_bytes,error_code=null,lease_id=null,lease_until=null where file_id=file;
 if b.event_id is null then
  event:=private.emit_change(b.couple_id,actor,b.id,'upload','create',b.id);
  select recipient_id into recipient from public.notifications where event_id=event;
  update public.upload_batches set event_id=event,recipient_id=recipient where id=batch;
 end if;
 update public.upload_batches set success_count=success_count+1,failure_count=(select count(*) from public.upload_files where batch_id=batch and state='failed') where id=batch;
 return file;
end $$;

create function public.fail_upload_file(actor uuid,batch uuid,file uuid,claim uuid,code text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if code not in('NOT_UPLOADED','INVALID_IMAGE','STORAGE_UNAVAILABLE') then raise exception 'INVALID_ERROR';end if;
 perform 1 from public.upload_batches b where b.id=batch and b.owner_id=actor and exists(select 1 from public.memberships where user_id=actor and couple_id=b.couple_id) for update;
 if not found then raise exception 'ACCESS_DENIED';end if;
 update public.upload_files set state='failed',error_code=code,lease_id=null,lease_until=null where file_id=file and batch_id=batch and state='processing' and lease_id=claim and lease_until>now();
 if found then update public.upload_batches set failure_count=(select count(*) from public.upload_files where batch_id=batch and state='failed') where id=batch;end if;
end $$;

create function public.release_upload_staging(actor uuid,batch uuid,file uuid) returns void
language plpgsql security definer set search_path='' as $$
declare f public.upload_files;
begin
 perform 1 from public.upload_batches b where b.id=batch and b.owner_id=actor and exists(select 1 from public.memberships where user_id=actor and couple_id=b.couple_id) for update;
 if not found then raise exception 'ACCESS_DENIED';end if;
 select * into f from public.upload_files where file_id=file and batch_id=batch and state='ready' for update;
 if not found or f.staging_bytes=0 then return;end if;
 update private.usage_budget set committed_bytes=committed_bytes-f.staging_bytes where scope='media';
 update public.upload_files set staging_bytes=0 where file_id=file;
end $$;

create function public.complete_upload_command(actor uuid,command text,payload jsonb,op uuid,request_hash text,token_expiry timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.upload_batches;f public.upload_files;receipt public.operation_receipts;result jsonb;
begin
 if command not in('upload.finalize','upload.close') or token_expiry<=now() or token_expiry>now()+interval '30 days 1 minute' then raise exception 'INVALID_OPERATION';end if;
 select * into b from public.upload_batches where id=(payload->>'batch_id')::uuid and owner_id=actor for update;
 if not found or not exists(select 1 from public.memberships where user_id=actor and couple_id=b.couple_id) then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into receipt from public.operation_receipts where actor_id=actor and operation_id=op;
 if found then if receipt.command<>command or receipt.request_hash<>request_hash then raise exception 'OPERATION_CONFLICT';end if;return receipt.result_reference;end if;
 if command='upload.close' then
  update public.upload_batches set state=case when expires_at<=now() then 'expired' else 'closed' end,closed_at=coalesce(closed_at,now()) where id=b.id and state='open';
  update public.upload_reservations set state=(select state from public.upload_batches where id=b.id) where batch_id=b.id;
  result:=jsonb_build_object('batch_id',b.id,'state',(select state from public.upload_batches where id=b.id));
  -- Unpublished reservation bytes remain charged until maintenance confirms physical cleanup.
 else
  if not exists(select 1 from public.upload_reservations where id=(payload->>'reservation_id')::uuid and batch_id=b.id) or jsonb_array_length(payload->'file_ids')<>1 then raise exception 'ACCESS_DENIED';end if;
  select * into f from public.upload_files where file_id=(payload->'file_ids'->>0)::uuid and batch_id=b.id for update;
  if not found or f.state not in('ready','failed') then raise exception 'UPLOAD_BUSY_CONFLICT';end if;
  result:=jsonb_build_object('batch_id',b.id,'files',jsonb_build_array(jsonb_build_object('file_id',f.file_id,'state',f.state,'photo_id',f.photo_id,'error_code',f.error_code)));
 end if;
 insert into public.operation_receipts values(actor,op,command,request_hash,result,token_expiry,token_expiry+interval '24 hours');return result;
end $$;
revoke all on function public.claim_upload_file(uuid,uuid,uuid,uuid),public.publish_upload_file(uuid,uuid,uuid,uuid,uuid,bigint,integer,integer,text),public.fail_upload_file(uuid,uuid,uuid,uuid,text),public.release_upload_staging(uuid,uuid,uuid),public.complete_upload_command(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_upload_file(uuid,uuid,uuid,uuid),public.publish_upload_file(uuid,uuid,uuid,uuid,uuid,bigint,integer,integer,text),public.fail_upload_file(uuid,uuid,uuid,uuid,text),public.release_upload_staging(uuid,uuid,uuid),public.complete_upload_command(uuid,text,jsonb,uuid,text,timestamptz) to service_role;


-- Revoke an in-flight lease before compensating object deletion. A late commit cannot publish
-- metadata referencing bytes being removed; a replacement lease blocks another claimant meanwhile.
create function public.quarantine_upload_file(actor uuid,batch uuid,file uuid,claim uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.upload_files;cleanup uuid;
begin
 perform 1 from public.upload_batches b where b.id=batch and b.owner_id=actor and exists(select 1 from public.memberships where user_id=actor and couple_id=b.couple_id) for update;
 if not found then raise exception 'ACCESS_DENIED';end if;
 select * into f from public.upload_files where file_id=file and batch_id=batch for update;
 if not found then raise exception 'ACCESS_DENIED';end if;
 if f.state='ready' then return jsonb_build_object('state','ready','photo_id',f.photo_id);end if;
 if f.state<>'processing' or f.lease_id is distinct from claim or f.lease_until<=now() then raise exception 'UPLOAD_BUSY_CONFLICT';end if;
 cleanup:=gen_random_uuid();
 update public.upload_files set lease_id=cleanup,lease_until=now()+interval '3 minutes' where file_id=file;
 return jsonb_build_object('state','processing','lease_id',cleanup,'media_path',f.media_path);
end $$;
revoke all on function public.quarantine_upload_file(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.quarantine_upload_file(uuid,uuid,uuid,uuid) to service_role;
