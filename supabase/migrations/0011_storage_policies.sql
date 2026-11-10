-- Depends on 0010 upload reservation tables and helpers. Buckets are never public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('staging','staging',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('media','media',false,10485760,array['image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy reserved_stage_insert on storage.objects for insert to authenticated
 with check(bucket_id='staging' and storage.allow_only_operation('storage.object.upload') and private.can_stage(name));
-- Operation-aware SELECT prevents createSignedUrl and listing from inheriting download access.
create policy ready_media_download on storage.objects for select to authenticated
 using(bucket_id='media' and storage.allow_only_operation('storage.object.get_authenticated') and private.can_read_media(name));
-- No browser staging reads, object updates/deletes, signing, listing, S3 or Tus policy.
