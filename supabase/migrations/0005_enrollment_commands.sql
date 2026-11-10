create function public.bootstrap_operator(first_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.couples) then raise exception 'SETUP_CLOSED'; end if;
 if not exists(select 1 from auth.users where id=first_id and email_confirmed_at is not null) then raise exception 'VERIFIED_IDENTITY_REQUIRED'; end if;
 insert into private.bootstrap_eligibility(singleton,first_user_id) values(true,first_id);
end $$;
revoke all on function public.bootstrap_operator(uuid) from public,anon,authenticated;
grant execute on function public.bootstrap_operator(uuid) to service_role;
create function public.commit_enrollment(actor uuid,command text,payload jsonb,op uuid,request_hash text,token_expiry timestamptz,invite_hash text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt public.operation_receipts; space uuid; result jsonb; invitation public.invitations; email text; target uuid; zone text; start_day date;
begin
 if actor is null or token_expiry<=now() or token_expiry>now()+interval '30 days 1 minute' then raise exception 'INVALID_OPERATION'; end if;
 select lower(u.email) into email from auth.users u where id=actor and email_confirmed_at is not null;
 if email is null then raise exception 'ACCESS_DENIED'; end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select * into receipt from public.operation_receipts where actor_id=actor and operation_id=op;
 if found then
  if receipt.command<>command or receipt.request_hash<>request_hash then raise exception 'OPERATION_CONFLICT'; end if;
  if not exists(select 1 from public.memberships where user_id=actor) then raise exception 'ACCESS_DENIED'; end if;
  return receipt.result_reference||jsonb_build_object('replayed',true);
 end if;
 if command='couple.create' then
  perform 1 from private.bootstrap_eligibility where first_user_id=actor and consumed_at is null for update;
  if not found or exists(select 1 from public.couples) then raise exception 'ACCESS_DENIED'; end if;
  zone:=payload->>'timezone'; start_day:=(payload->>'start_date')::date;
  if not exists(select 1 from pg_timezone_names where name=zone) or start_day>(now() at time zone zone)::date then raise exception 'INVALID_DATE'; end if;
  insert into public.profiles(user_id,display_name) values(actor,split_part(email,'@',1)) on conflict(user_id) do nothing;
  insert into public.couples(name,start_date,timezone) values(payload->>'name',start_day,zone) returning id into space;
  insert into public.memberships(couple_id,user_id,slot) values(space,actor,1);
  update private.bootstrap_eligibility set consumed_at=now() where first_user_id=actor;
  result:=jsonb_build_object('id',space,'version',1);
 elsif command='invitation.create' then
  select couple_id into space from public.memberships where user_id=actor and slot=1;
  if space is null then raise exception 'ACCESS_DENIED'; end if;
  perform 1 from public.couples where id=space for update;
  if exists(select 1 from public.memberships where couple_id=space and slot=2) then raise exception 'SPACE_FULL'; end if;
  if lower(payload->>'recipient_email')=email or invite_hash is null then raise exception 'INVALID_INVITATION'; end if;
  update public.invitations set state='expired',version=version+1 where couple_id=space and state='pending' and expires_at<=now();
  insert into public.invitations(couple_id,issuer_id,recipient_email,token_hash,expires_at) values(space,actor,lower(payload->>'recipient_email'),invite_hash,now()+interval '48 hours') returning id into target;
  result:=jsonb_build_object('id',target,'version',1);
 elsif command='invitation.revoke' then
  select couple_id into space from public.memberships where user_id=actor and slot=1;
  update public.invitations set state='revoked',version=version+1,updated_at=now() where id=(payload->>'id')::uuid and couple_id=space and state='pending' and version=(payload->>'expected_version')::integer returning id into target;
  if target is null then raise exception 'CONFLICT'; end if;
  result:=jsonb_build_object('id',target);
 elsif command='invitation.accept' then
  select * into invitation from public.invitations where token_hash=encode(extensions.digest(payload->>'token','sha256'),'hex');
  if invitation.id is null then raise exception 'ACCESS_DENIED'; end if;
  perform 1 from public.couples where id=invitation.couple_id for update;
  select * into invitation from public.invitations where id=invitation.id for update;
  if invitation.state<>'pending' or invitation.expires_at<=now() or invitation.recipient_email<>email or exists(select 1 from public.memberships where user_id=actor or (couple_id=invitation.couple_id and slot=2)) then raise exception 'ACCESS_DENIED'; end if;
  insert into public.profiles(user_id,display_name) values(actor,split_part(email,'@',1)) on conflict(user_id) do nothing;
  insert into public.memberships(couple_id,user_id,slot) values(invitation.couple_id,actor,2);
  update public.invitations set state='accepted',version=version+1,updated_at=now() where id=invitation.id;
  result:=jsonb_build_object('id',invitation.couple_id);
 else raise exception 'INVALID_COMMAND'; end if;
 insert into public.operation_receipts(actor_id,operation_id,command,request_hash,result_reference,token_expires_at,purge_after) values(actor,op,command,request_hash,result,token_expiry,token_expiry+interval '24 hours');
 return result||jsonb_build_object('replayed',false);
end $$;
revoke all on function public.commit_enrollment(uuid,text,jsonb,uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.commit_enrollment(uuid,text,jsonb,uuid,text,timestamptz,text) to service_role;

create function public.invitation_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',i.id,'version',i.version,'state',i.state,'expires_at',i.expires_at) from public.invitations i
 join public.memberships m on m.couple_id=i.couple_id where m.user_id=auth.uid() and m.slot=1 and i.state='pending' and i.expires_at>now() limit 1
$$;
revoke all on function public.invitation_status() from public,anon;
grant execute on function public.invitation_status() to authenticated;
