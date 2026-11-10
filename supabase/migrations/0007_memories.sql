create table public.memories (
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id),creator_id uuid not null references public.profiles(user_id),
 title text not null check(char_length(btrim(title)) between 1 and 200),description text not null default '' check(char_length(description)<=10000),event_date date not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,unique(couple_id,id)
);
alter table public.memories enable row level security;
revoke all on public.memories from anon,authenticated;
grant select on public.memories to authenticated;
grant all on public.memories to service_role;
