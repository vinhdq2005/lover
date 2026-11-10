-- Identity schema already exists in 0001. Keep extensions separate from object creation.
alter table public.invitations add constraint invitation_hash_format check(token_hash ~ '^[0-9a-f]{64}$');
