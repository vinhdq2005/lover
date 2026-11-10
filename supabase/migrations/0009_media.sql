create table public.albums (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id),
 creator_id uuid not null references public.profiles(user_id), title text not null check(char_length(btrim(title)) between 1 and 200),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(couple_id,id)
);
create table public.photos (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id),
 uploader_id uuid not null references public.profiles(user_id), album_id uuid,
 storage_path text not null unique, preview_path text unique, description text not null default '' check(char_length(description)<=2000),
 event_date date not null, bytes bigint not null check(bytes between 1 and 10485760),
 format text not null check(format in('image/jpeg','image/png','image/webp')),
 width integer not null check(width between 1 and 1600),height integer not null check(height between 1 and 1600),
 state text not null default 'ready' check(state in('ready','deleting','deleted')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,
 unique(couple_id,id),unique(uploader_id,id),
 foreign key(couple_id,album_id) references public.albums(couple_id,id)
);
create table public.memory_photos (
 couple_id uuid not null,memory_id uuid not null,photo_id uuid not null,position integer not null check(position>=0),
 primary key(memory_id,photo_id),unique(memory_id,position),
 foreign key(couple_id,memory_id) references public.memories(couple_id,id) on delete cascade,
 foreign key(couple_id,photo_id) references public.photos(couple_id,id)
);
alter table public.couples add constraint featured_photo_same_space foreign key(id,featured_photo_id) references public.photos(couple_id,id) deferrable initially immediate;
alter table public.profiles add constraint own_avatar foreign key(user_id,avatar_photo_id) references public.photos(uploader_id,id) deferrable initially immediate;
alter table public.albums enable row level security;
alter table public.photos enable row level security;
alter table public.memory_photos enable row level security;
revoke all on public.albums,public.photos,public.memory_photos from anon,authenticated;
grant select on public.albums,public.photos,public.memory_photos to authenticated;
grant all on public.albums,public.photos,public.memory_photos to service_role;
create policy album_read on public.albums for select to authenticated using(private.is_member(couple_id));
create policy photo_read on public.photos for select to authenticated using(state='ready' and private.is_member(couple_id));
create policy memory_photo_read on public.memory_photos for select to authenticated using(private.is_member(couple_id) and exists(select 1 from public.photos p where p.id=photo_id and p.couple_id=memory_photos.couple_id and p.state='ready'));
create index photos_page on public.photos(couple_id,event_date desc,created_at desc,id desc) where state='ready';
