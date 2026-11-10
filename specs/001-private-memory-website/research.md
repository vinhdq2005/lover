# Research: Free-Tier Lover Architecture

Checked: 2026-11-07. Decisions below resolve the planning unknowns; account-specific sender approval
remains a release check with a safe disabled default. Recheck account dashboards before launch.

## 1. Frontend and hosting

**Decision**: React/TypeScript/Vite static SPA, Tailwind Vite plugin, Node 22.12+ baseline. Pin
compatible versions and lockfile during implementation. Netlify Free, netlify.app HTTPS hostname.
**Rationale**: No custom server or domain purchase. Current Netlify Free provides 300 credits/month
with a hard limit; legacy accounts may have different meters. Budget production deploys and traffic,
and accept suspension at the limit. Do not equate a hosting hostname with DNS ownership for email.
**Alternatives considered**: SSR, Netlify Functions and custom domains add no MVP value.
Sources: [Vite](https://vite.dev/guide/),
[Tailwind](https://tailwindcss.com/docs/installation/using-vite),
[Netlify plans](https://www.netlify.com/pricing/),
[credit plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

## 2. Backend and capacity

**Decision**: Supabase Free Auth/PostgreSQL/private Storage/Edge Functions; RLS on every exposed
private table and separate object policies. Free snapshot: 500 MB database, 1 GB file storage,
500,000 Edge invocations/month. Egress has distinct cached/uncached 5 GB allowances; do not pool
them as unrestricted traffic. Track actual account meters. Free image transformations are unavailable.
**Rationale**: Fits two users only with bounded media and pagination. Internal cap: 800 MiB all
stored objects; 350 MB DB warning/400 MB growth stop. Edge limits include 256 MB memory, 2 seconds
CPU per request and 150 seconds free wall-clock; validate media decoder performance against these.
**Alternatives considered**: Public buckets violate privacy; unlimited originals cannot fit free storage.
Sources: [billing](https://supabase.com/docs/guides/platform/billing-on-supabase),
[egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress),
[limits](https://supabase.com/docs/guides/functions/limits),
[private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[storage policies](https://supabase.com/docs/guides/storage/security/access-control).

## 3. Sender verification without an owned domain

**Decision**: Brevo adapter exists behind a disabled adapter. Verifying a sender mailbox via emailed
code does not authenticate its domain. Free-provider addresses cannot supply domain DNS control.
An owned website at netlify.app does not grant sender-domain authentication. Enable only after
Brevo approves the actual From identity, applicable domain rules are met, and a real partner test
succeeds. If unavailable, remain in-app only; do not buy a domain or imply reliable production mail.
**Rationale**: Meets zero-cost constraint without substituting verification for domain authentication.
**Alternatives considered**: Spoofing a netlify.app From address or treating Gmail verification as
DKIM/DMARC authentication is invalid. Another provider can replace the adapter later.
Sources: [create sender](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email),
[domain troubleshooting](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication),
[domain authentication](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC).

## 4. Email limits and duplicate prevention

**Decision**: Current Brevo Free allowance is 300 emails/day, no rollover. Use internal 100/day cap
including invitation/test mail, no paid fallback. Provider acceptance is not inbox delivery.
Use durable unique event/recipient/channel rows and leased claims. Brevo's documented batch-send
idempotency uses headers.idempotencyKey with a 30-minute lifetime: choose that documented endpoint
shape even for a single partner recipient. Reuse key only inside that window. Unknown acceptance
outside the window requires reconciliation, not blind retries.
**Rationale**: A database uniqueness constraint alone cannot make an external email exactly-once.
In-app delivery is transactional and independent of email failures.
**Alternatives considered**: Fire-and-forget sends lose events; infinite retries duplicate emails.
Sources: [Free allowance](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan),
[idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails).

## 5. Authentication independent of email

**Decision**: Disable public/anonymous signup. Controlled operator bootstrap and provisioning of
only the two known accounts; email/password sign-in. Operator verifies mailbox control before any
admin-confirmed identity. Existing member creates a hashed, 48-hour one-use invitation bound to
partner email. If sending is unavailable, share the invitation privately outside the app. It cannot
create arbitrary confirmed accounts. Password recovery is operator-assisted while email is disabled.
**Rationale**: Supabase default SMTP currently limits recipients to project-team addresses and about
two messages/hour, with best-effort delivery. Do not give a partner infrastructure admin access to
make Auth mail work. Admin createUser belongs only in trusted operator tooling.
**Alternatives considered**: Magic-link-only login would fail when email is disabled.
Sources: [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp),
[admin provisioning](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[Auth configuration](https://supabase.com/docs/guides/auth/general-configuration).

## 6. Privacy, dates, and recovery

**Decision**: Authenticated downloads, no public/signed bearer links; in-memory blobs cleared on
logout. Date-only relationship arithmetic in couple timezone, including February 29 rule from spec.
Use fixed-clock tests, owner-scoped mutations, and row-version conflicts. Manual encrypted exports
of DB and media with <=30-day rotation and restore tests; Free has no assumed managed backup SLA.
**Rationale**: These choices preserve privacy and keep operating costs zero. Preview bytes count
against storage. Free projects may pause; do not simulate traffic to evade inactivity policies.
**Alternatives considered**: Persisted browser private cache and permanent media links increase exposure.
Sources: [authenticated downloads](https://supabase.com/docs/guides/storage/serving/downloads),
[backups](https://supabase.com/docs/guides/platform/backups).


## Approved consistency refinements

**Decision**: Controlled enrollment exceptions, identity-first migrations, signed 30-day command
operations with receipts through expiry +24h, stable batch/file identities and one evolving batch
notification. Retain relationship content; expire operational history after 90 days. Immediate
post-commit dispatch plus one-minute recovery, with conditional five-minute external email target.
**Rationale**: Resolves approved findings without a new service. Tokens supplement authorization;
email remains disabled without sender eligibility. No new provider capability claims introduced.
**Alternatives considered**: Bare UUID cannot prove age after receipt deletion; new batches on retry
duplicate content/events; five-minute polling alone leaves no delivery-time margin.

## I5/U3/G2 follow-through

**Decision**: Reservation schema precedes storage policies (0010_upload_reservations.sql then
0011_storage_policies.sql). Issue signed operations from actual validated/authorized payloads with
server-derived hashes. Read batch inbox summaries through a minimized recipient/same-couple projection.
**Rationale**: Clean replay must not depend on future tables; opaque client hashes cannot establish
operation intent; inbox summaries must preserve recipient-only authorization and one batch notice.
**Alternatives considered**: Forward policy references, hash-only issuance and raw batch-table inbox
reads leave dependency or access contracts incomplete. No hosted service or architecture is added.


## Implementation experiment - image resource gate

ImageMagick WASM 0.0.46 and ImageScript 3.13.1 were evaluated with synthetic images only.
The lighter ImageScript decoder reduced standalone processing time, but the actual local Edge
worker (256 MB, CPU soft/hard limits 1000/2000 ms) still rejected a valid 24 MP JPEG with
546 WORKER_LIMIT. That raw-source decoder failure was superseded on 2026-11-08 by browser
preparation plus independent bounded server decoding. Source selection still permits <=24 MP and
<=10 MiB; only a compressed <=1600-longest-edge copy is stored. The actual worker validated the
prepared 24 MP fixture in 77 ms and rejected direct raw-source bypass with 422 before decoding.
No paid processor, higher worker limits or new hosting service was added. Private direct-to-staging
upload, exact-path reservation and server-only publication remain mandatory and unimplemented.
See [runtime evidence](validation/image-resource-gate.md).

References: [Supabase image processing](https://supabase.com/docs/guides/functions/examples/image-manipulation),
[ImageScript documentation](https://imagescript.dev/index.html).
