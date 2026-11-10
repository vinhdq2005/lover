# Private media maintenance

Maintenance is implemented but has not been deployed. The worker accepts only the server-side
WORKER_SECRET header, claims one five-minute lease, and processes at most 20 jobs per call. It never
uses a browser-supplied object path. Expired unused reservations wait at least three minutes after
closure/expiry and until file leases end before cleanup; their bytes remain reserved until deletion
is confirmed. Saved photos survive batch expiry. Missing ready objects are flagged for restoration,
with saved metadata and conservative byte accounting retained.

After release acceptance, an operator must configure two Supabase Vault entries in the intended
project: lover_edge_base_url (the HTTPS Supabase project endpoint ending /functions/v1) and
lover_worker_secret (matching Edge WORKER_SECRET). Do not use a frontend key or a netlify.app URL.
Until both entries exist, the scheduled SQL function returns without any outbound request.
The existing one-minute Cron job is network-inactive in disposable tests; tests invoke the worker
directly with their separately generated test secret. No production entries were created.

Schema grants deny browser roles access to the pg_net request/response tables, which may temporarily
contain dispatch credentials. Keep Vault and infrastructure access restricted to the operator.
See [Supabase scheduling guidance](https://supabase.com/docs/guides/functions/schedule-functions).
Review quota and failed cleanup counts weekly; failed object deletion leaves accounting intact for
the next run. An unknown/missing object is not permission to erase relationship metadata.

This configuration is separate from optional email sending and does not activate Brevo or Auth SMTP.
