-- Keep the verified relationship/text-memory routines intact behind the expanded command boundary.
alter function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) set schema private;
alter function private.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) rename to commit_relationship_memory;
revoke all on function private.commit_relationship_memory(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated,service_role;

create function private.commit_memory_photos(actor uuid,command text,payload jsonb,op uuid,request_hash text,token_expiry timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare space uuid;receipt public.operation_receipts;selected jsonb:=payload->'photo_ids';existing jsonb:='[]';prior integer;result jsonb;target uuid;changed boolean;
begin
 if command not in('memory.create','memory.update') or token_expiry<=now() or token_expiry>now()+interval '30 days 1 minute' then raise exception 'INVALID_OPERATION';end if;
 select couple_id into space from public.memberships where user_id=actor;if space is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into receipt from public.operation_receipts where actor_id=actor and operation_id=op;
 if found then if receipt.command<>command or receipt.request_hash<>request_hash then raise exception 'OPERATION_CONFLICT';end if;return receipt.result_reference;end if;
 perform 1 from public.couples where id=space for update;
 if jsonb_typeof(selected)<>'array' then raise exception 'INVALID_REFERENCE';end if;
 if (select count(distinct value) from jsonb_array_elements_text(selected))<>jsonb_array_length(selected) or (select count(*) from public.photos where couple_id=space and state='ready' and id in(select value::uuid from jsonb_array_elements_text(selected)))<>jsonb_array_length(selected) then raise exception 'INVALID_REFERENCE';end if;
 if command='memory.update' then
  target:=(payload->>'id')::uuid;
  select version into prior from public.memories where id=target and couple_id=space and creator_id=actor and version=(payload->>'expected_version')::integer;
  if not found then raise exception 'CONFLICT';end if;
  select coalesce(jsonb_agg(photo_id order by position),'[]') into existing from public.memory_photos where memory_id=target and couple_id=space;
 end if;
 changed:=existing<>selected;
 result:=private.commit_relationship_memory(actor,command,payload,op,request_hash,token_expiry);target:=(result->>'id')::uuid;
 if changed then
  delete from public.memory_photos where memory_id=target and couple_id=space;
  insert into public.memory_photos(couple_id,memory_id,photo_id,position) select space,target,value::uuid,ordinality-1 from jsonb_array_elements_text(selected) with ordinality;
  if command='memory.update' and (select version from public.memories where id=target)=prior then
   update public.memories set version=version+1,updated_at=now() where id=target;
   perform private.emit_change(space,actor,op,'memory','update',target);
  end if;
 end if;
 return result;
end $$;
revoke all on function private.commit_memory_photos(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated,service_role;

create function public.commit_mutation(actor uuid,command text,payload jsonb,op uuid,request_hash text,token_expiry timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare space uuid;receipt public.operation_receipts;category text:=split_part(command,'.',1);action text:=split_part(command,'.',2);target uuid;album public.albums;photo public.photos;zone text;result jsonb;unchanged boolean:=false;
begin
 if category='memory' and command in('memory.create','memory.update') and payload ? 'photo_ids' then return private.commit_memory_photos(actor,command,payload,op,request_hash,token_expiry);end if;
 if category not in('album','photo') then return private.commit_relationship_memory(actor,command,payload,op,request_hash,token_expiry);end if;
 if actor is null or token_expiry<=now() or token_expiry>now()+interval '30 days 1 minute' then raise exception 'INVALID_OPERATION';end if;
 select couple_id into space from public.memberships where user_id=actor;if space is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into receipt from public.operation_receipts where actor_id=actor and operation_id=op;
 if found then if receipt.command<>command or receipt.request_hash<>request_hash then raise exception 'OPERATION_CONFLICT';end if;return receipt.result_reference;end if;
 select timezone into zone from public.couples where id=space for update;
 if category='album' then
  if action='create' then insert into public.albums(couple_id,creator_id,title) values(space,actor,payload->>'title') returning id into target;
  else
   select * into album from public.albums where id=(payload->>'id')::uuid and couple_id=space and creator_id=actor for update;
   if not found or album.version<>(payload->>'expected_version')::integer then raise exception 'CONFLICT';end if;
   target:=album.id;
   if action='update' then
    unchanged:=album.title=payload->>'title';
    if not unchanged then update public.albums set title=payload->>'title',version=version+1,updated_at=now() where id=target;end if;
   elsif action='delete' then
    update public.photos set album_id=null,version=version+1,updated_at=now() where couple_id=space and album_id=target;
    delete from public.albums where id=target;
   else raise exception 'INVALID_COMMAND';end if;
  end if;
 else
  select * into photo from public.photos where id=(payload->>'id')::uuid and couple_id=space and uploader_id=actor and state='ready' for update;
  if not found or photo.version<>(payload->>'expected_version')::integer then raise exception 'CONFLICT';end if;
  target:=photo.id;
  if action='update' then
   if (payload->>'event_date')::date>(now() at time zone zone)::date then raise exception 'INVALID_DATE';end if;
   if payload->>'album_id' is not null and not exists(select 1 from public.albums where id=(payload->>'album_id')::uuid and couple_id=space) then raise exception 'INVALID_REFERENCE';end if;
   unchanged:=photo.description=payload->>'description' and photo.event_date=(payload->>'event_date')::date and photo.album_id is not distinct from (payload->>'album_id')::uuid;
   if not unchanged then update public.photos set description=payload->>'description',event_date=(payload->>'event_date')::date,album_id=(payload->>'album_id')::uuid,version=version+1,updated_at=now() where id=target;end if;
  elsif action='delete' then
   update public.couples set featured_photo_id=null,version=version+1,updated_at=now() where id=space and featured_photo_id=target;
   update public.profiles set avatar_photo_id=null,version=version+1,updated_at=now() where avatar_photo_id=target;
   update public.memories set version=version+1,updated_at=now() where couple_id=space and id in(select memory_id from public.memory_photos where couple_id=space and photo_id=target);
   delete from public.memory_photos where couple_id=space and photo_id=target;
   update public.photos set state='deleting',version=version+1,updated_at=now() where id=target;
  else raise exception 'INVALID_COMMAND';end if;
 end if;
 if target is null then raise exception 'CONFLICT';end if;
 if not unchanged then perform private.emit_change(space,actor,op,category,action,target);end if;
 result:=jsonb_build_object('id',target);
 insert into public.operation_receipts values(actor,op,command,request_hash,result,token_expiry,token_expiry+interval '24 hours');return result;
end $$;
revoke all on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) to service_role;
