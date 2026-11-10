alter function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) set schema private;
alter function private.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) rename to commit_before_settings;
revoke all on function private.commit_before_settings(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated,service_role;
create function public.commit_mutation(actor uuid,command text,payload jsonb,op uuid,request_hash text,token_expiry timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare space uuid;receipt public.operation_receipts;settings public.couples;profile public.profiles;
 selected_photo uuid;new_name text;zone text;start_day date;meeting_day date;target uuid;unchanged boolean;result jsonb;
begin
 if command not in ('profile.update','couple.update') then return private.commit_before_settings(actor,command,payload,op,request_hash,token_expiry);end if;
 if actor is null or token_expiry<=now() or token_expiry>now()+interval '30 days 1 minute' then raise exception 'INVALID_OPERATION';end if;
 select couple_id into space from public.memberships where user_id=actor;if space is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into receipt from public.operation_receipts where actor_id=actor and operation_id=op;
 if found then if receipt.command<>command or receipt.request_hash<>request_hash then raise exception 'OPERATION_CONFLICT';end if;return receipt.result_reference;end if;
 select * into settings from public.couples where id=space for update;
 if command='profile.update' then
  if payload ? 'user_id' or payload ? 'email' or payload ? 'couple_id' then raise exception 'INVALID_OPERATION';end if;
  select * into profile from public.profiles where user_id=actor for update;
  if not found or (payload->>'expected_version')::integer is distinct from profile.version then raise exception 'CONFLICT';end if;
  selected_photo:=case when payload ? 'avatar_photo_id' then (payload->>'avatar_photo_id')::uuid else profile.avatar_photo_id end;
  if selected_photo is not null and not exists(select 1 from public.photos where id=selected_photo and couple_id=space and uploader_id=actor and state='ready') then raise exception 'INVALID_REFERENCE';end if;
  new_name:=payload->>'display_name';
  unchanged:=profile.display_name is not distinct from new_name and profile.avatar_photo_id is not distinct from selected_photo;
  if not unchanged then update public.profiles set display_name=new_name,avatar_photo_id=selected_photo,version=version+1,updated_at=now() where user_id=actor;end if;
  target:=actor;
 else
  if (payload->>'expected_version')::integer is distinct from settings.version then raise exception 'CONFLICT';end if;
  selected_photo:=case when payload ? 'featured_photo_id' then (payload->>'featured_photo_id')::uuid else settings.featured_photo_id end;
  if selected_photo is not null and not exists(select 1 from public.photos where id=selected_photo and couple_id=space and state='ready') then raise exception 'INVALID_REFERENCE';end if;
  new_name:=coalesce(payload->>'name',settings.name);zone:=coalesce(payload->>'timezone',settings.timezone);
  if not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'INVALID_DATE';end if;
  start_day:=coalesce((payload->>'start_date')::date,settings.start_date);
  meeting_day:=case when payload ? 'first_meeting_date' then (payload->>'first_meeting_date')::date else settings.first_meeting_date end;
  if start_day>(now() at time zone zone)::date or meeting_day>start_day then raise exception 'INVALID_DATE';end if;
  unchanged:=settings.name=new_name and settings.timezone=zone and settings.start_date=start_day and settings.first_meeting_date is not distinct from meeting_day and settings.featured_photo_id is not distinct from selected_photo;
  if not unchanged then update public.couples set name=new_name,timezone=zone,start_date=start_day,first_meeting_date=meeting_day,featured_photo_id=selected_photo,version=version+1,updated_at=now() where id=space;end if;
  target:=space;
 end if;
 if not unchanged then perform private.emit_change(space,actor,op,split_part(command,'.',1),'update',target);end if;
 result:=jsonb_build_object('id',target);
 insert into public.operation_receipts values(actor,op,command,request_hash,result,token_expiry,token_expiry+interval '24 hours');
 return result;
end $$;
revoke all on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.commit_mutation(uuid,text,jsonb,uuid,text,timestamptz) to service_role;
