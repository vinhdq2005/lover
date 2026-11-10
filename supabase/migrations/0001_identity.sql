create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
create table public.couples (
 id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check(singleton),
 name text not null check(char_length(btrim(name)) between 1 and 100), start_date date not null,
 first_meeting_date date, timezone text not null default 'Asia/Ho_Chi_Minh', featured_photo_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 check(first_meeting_date is null or first_meeting_date<=start_date)
);
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete restrict, display_name text not null check(char_length(btrim(display_name)) between 1 and 100),
 avatar_photo_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.memberships (
 couple_id uuid not null references public.couples(id), user_id uuid not null references public.profiles(user_id),
 slot smallint not null check(slot in(1,2)), joined_at timestamptz not null default now(),
 primary key(couple_id,user_id), unique(user_id), unique(couple_id,slot)
);
create table public.invitations (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id), issuer_id uuid not null references public.profiles(user_id),
 recipient_email text not null check(recipient_email=lower(btrim(recipient_email))), token_hash text not null unique,
 state text not null default 'pending' check(state in('pending','accepted','revoked','expired')), expires_at timestamptz not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create unique index one_pending_invitation on public.invitations(couple_id) where state='pending';
create table private.bootstrap_eligibility (
 singleton boolean primary key default true check(singleton), first_user_id uuid not null unique references auth.users(id), consumed_at timestamptz
);
create function private.is_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.couple_id=target and m.user_id=auth.uid())
$$;
revoke all on function private.is_member(uuid) from public,anon;
grant execute on function private.is_member(uuid) to authenticated;
create function private.shares_space(target_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships a join public.memberships b using(couple_id) where a.user_id=auth.uid() and b.user_id=target_user)
$$;
revoke all on function private.shares_space(uuid) from public,anon;
grant execute on function private.shares_space(uuid) to authenticated;
alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
revoke all on public.couples,public.profiles,public.memberships,public.invitations from anon,authenticated;
grant select on public.couples,public.profiles,public.memberships to authenticated;
create policy couple_member_read on public.couples for select to authenticated using(private.is_member(id));
create policy profile_shared_read on public.profiles for select to authenticated using(private.shares_space(user_id));
create policy membership_shared_read on public.memberships for select to authenticated using(private.is_member(couple_id));
-- Invitation tokens/emails never have a generic SELECT grant. Commands return safe issuer status.
grant all on public.couples,public.profiles,public.memberships,public.invitations to service_role;
