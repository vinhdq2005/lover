create policy memory_read on public.memories for select to authenticated using(private.is_member(couple_id));
create index memories_timeline on public.memories(couple_id,event_date desc,created_at desc,id desc);
