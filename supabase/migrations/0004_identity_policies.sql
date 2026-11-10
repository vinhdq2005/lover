-- Reassert fixed-path helpers and deny generic DML during enrollment rollout.
revoke insert,update,delete on public.couples,public.profiles,public.memberships,public.invitations from authenticated,anon;
