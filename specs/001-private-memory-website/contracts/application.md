# Application Contracts

Design contract; routes/routines are proposed, not deployed. All responses carrying private data
use Cache-Control: no-store. Exact production origin and localhost dev origin allowed by CORS;
CORS is not authorization. All user commands require a valid Supabase access token verified with
Auth and current membership for ordinary commands. Enrollment exceptions: couple.create requires
the operator-approved first identity and no existing space; invitation.accept requires the verified
intended identity and valid invitation. Neither allows private reads before membership. Operation
issuance applies the same command-specific authorization, never a blanket membership bypass.

## Authentication and errors

Supabase email/password login/logout; public signup and anonymous login disabled. No password or
service credential in invitations, logs, URLs, or frontend configuration. Session expiry clears
content and revokes object URLs. Controlled recovery is operator-assisted while Auth SMTP is unavailable.

Command envelope: server-issued operation_id UUID and signed operation_token, payload and
expected_version for existing-row mutation. operation.issue authenticates and authorizes the specific
command, rate-limits issuance, and signs actor, command, canonical request hash, server-issued time,
30-day expires_at and key ID. Batch operations additionally bind batch/file identities. Every attempt
verifies signature/actor/command/hash/expiry BEFORE receipt lookup and rechecks current authorization
and ownership (or narrow enrollment eligibility). Tokens are not authentication. Use distinct
server-only signing keys; retain verification keys through outstanding lifetimes except deliberate
revocation. Reject altered/expired tokens even after receipts are deleted.
Actor, recipient, ownership, couple scope and provider configuration are always server-derived.
Return result IDs/version, operation_id, and Vietnamese user feedback. Repeated identical operation
returns the safe original result if access still holds; changed payload with same key returns 409.
Retain receipts through token expiry +24 hours. Never renew/reissue an existing ID; changed payloads
need new server-issued IDs. Clients cannot choose issuance time or expiry.
An exact successful enrollment retry may return only its safe receipt to the same now-authorized
member of that created/joined space; it cannot rerun bootstrap or reveal another space.
Issuance requires the actual intended payload, relevant resource identifiers, expected_version for
existing-row mutations and batch/reservation/file IDs where applicable. Authenticate the actor,
validate and canonicalize inputs, authorize the specific operation intent and target (including
ownership/couple scope), then compute and sign the canonical hash server-side. Client-supplied
hashes are not accepted as an authorization or intent source. Reject missing/invalid/unauthorized
intents before issuance. Execution canonicalizes the actual request again and compares it with the
signed intent; reject modified payloads, target/version/upload IDs, mismatched actors or expiry.
Do not log request payloads, canonicalized content, private fields or tokens; use operation IDs and
safe error codes only. Issuance signs an immutable intent and creates no content change.
Errors: 400 validation, 401 session, 403 generic authorization, 404 unavailable resource without
existence disclosure, 409 stale/conflicting operation, 413 upload size, 415 type, 422 unsafe image,
429 quota/rate limit with retry guidance, 503 temporary service failure. Never include private
content, raw provider errors, tokens, or credentials in responses.

## Reads

Browser authenticated Data API reads under RLS: home summary, own/same-space profiles, memories,
albums/photos, entries, milestones, own notification inbox. Page size 30, maximum 50; cursors use
event_date/created_at/id descending. Memory filters accept inclusive from/to dates and reject
reversed ranges. Notification inbox exposes generic category/actor/time/deep-link/read status and
optional external delivery status. The actor cannot read the partner's inbox or delivery records.
For batch notifications, use a narrowly granted read RPC with fixed search_path and explicit
recipient/membership predicates. Its security-definer execution may read server-only summary rows,
but MUST independently enforce the predicates below; grant browser EXECUTE only, never raw-table
SELECT or an unrestricted view. No service-role browser read bypass.
Require auth.uid() = notification.recipient_id, active membership in notification.couple_id, and
matching notification/event/batch couple and event IDs. Upload batch identity is a reference, not
access authority. The nested upload_summary contains only batch_id, success_count, failure_count
and status (open/closed/expired); no filenames, paths, file IDs, intent hashes, tokens, errors with
private content, or raw upload rows. Return absent/unavailable uniformly for denied references.
Later successes update this same notification's projected summary without changing its ID/read_at
or producing another email. The uploader may see their own operational progress through owner-only
upload status, but cannot use it to read the partner's inbox. No browser SELECT on raw batch/file
rows through this projection; expose only owner-scoped upload status or this recipient projection.
Photo bytes use Storage authenticated download only after ready-metadata membership policy passes.
No public URL or signed bearer URL returned. Closing viewer/logout revokes temporary browser URL.

## Authenticated Edge commands

Single `api` Edge Function routes the following logical operations; parameter validation applies
spec FR-001 through FR-026 plus documented plan amendments.

| Operation | Input | Authorization and result |
| --- | --- | --- |
| operation.issue | command, actual intended command payload including resource IDs, expected_version for existing-row mutations, and batch/reservation/file IDs where applicable | Authenticate; validate/canonicalize actual inputs; authorize specific intent/target; compute canonical hash server-side; sign 30-day operation; no event |
| couple.create | name, start_date, timezone, operation_id | Controlled first account only; singleton + slot 1 transaction |
| invitation.create/revoke | verified target email or invitation_id | First member; vacant slot; token issued once, hash stored; safe status |
| invitation.accept | one-use token | Matching authenticated verified identity; locked max-two acceptance |
| memory.create/update/delete | title, description, event_date, photo_ids; id/version for edits | Same-space, author edits; photo references same-space and ready |
| album.create/update/delete | title; id/version | Creator edits; deletion detaches photos |
| entry.create/update/delete | kind, title, content, event_date; id/version | Author edits; shared read |
| profile.update | display_name, own avatar photo id, version | Own profile; referenced photo uploaded by self |
| couple.update | name, dates, timezone, featured_photo_id, version | Either member; featured photo same-space and ready |
| milestone.create/update/delete | label, original_date; id/version | Either member; calendar-date validation |
| upload.reserve | issued operation envelope, files(client_file_id, size, declared_type) | Member; <=20 files; <=10 MiB/file; atomic capacity reservation; opaque allocated paths |
| upload.finalize | issued operation envelope, batch_id, reservation_id, file_ids (exactly one file per command) | Owner; one bounded decode/request; validate/publish with stable per-file results; batches still allow 20 files |
| upload.close | issued operation envelope, batch_id | Owner; explicit close; one-hour expiry also closes batch |
| photo.update/delete | id, description, event_date, album_id, version | Uploader only; two-stage deletion and reference cleanup |
| notification.mark_read | notification_id | Recipient only; no new change event |
| notification.retry_email | notification_id | Recipient only; rate-limited; schedules eligible failed delivery, never sends arbitrary content/address |
| notification.preferences | email_enabled, expected_version (0 before first save) | Current member edits only their own opt-in; default false, in-app remains unconditional, no historical replay |

Source/preparation contract (2026-11-08): users may select JPEG/PNG/WebP <=10 MiB and <=24 MP.
Before reserving, the browser checks actual source headers, decodes and normalizes orientation,
then creates a metadata-free JPEG with longest edge <=1600, preserving aspect ratio without upscaling.
Transparent sources are composited on white. Explain that this compressed copy is saved and the
full-resolution source is not retained. If preparation fails, do not reserve or upload the raw source.
Keep the prepared File stable for retry; reservation size/type and signed intent describe its bytes,
not the source. Browser claims are untrusted: finalization independently inspects and fully decodes
actual staged bytes, with a <=1600-by-1600 decoding limit and <=10 MiB byte limit. Reject larger raw
images with 422 before decoder allocation. Neither browser optimization nor a valid header permits
publication without server validation. Upload directly to private staging using the user's JWT and
the existing exact-path reservation policy; no public/signed bearer URLs or service key in browser.

Files remain unreadable until individually validated and committed. Reserve returns server batch_id
and stable file_ids; unique(batch_id,file_id) prevents republishing. Successful file bytes/results
are immutable. Exact retries reuse signed operation; changed failed-file subsets get a newly issued
command operation while retaining batch/file IDs. Retry only failed/incomplete files until explicit
close or one-hour expiry; reject changes after closure, preserving saved photos. Lost responses
recover results without duplication. Reserve preview bytes; acquire extra capacity atomically.

First successful file commit atomically creates the batch's only immutable event, at most one
current-partner notification and one generic email disposition. Later successes update a separate
linked mutable summary (counts/status only), never another event/notification/email or read_at.
Recipient is fixed at first success; no partner then means no later replay. Generic email omits
changing counts, becomes eligible immediately at first success, and is never resent for later
successes. Zero-success batches emit nothing; closing freezes the summary. Client may reference
either partner's ready photo without gaining photo mutation permission.

## Notification contract and provider adapter

Outbox written transactionally with successful mutations; exactly one in-app row for the other
current member per event. No self-notification, no arbitrary recipient input, no notification for
no-op/failed operations. Invitation mail is a separate consent/enrollment message restricted to the
intended partner address, not a content notification. Manual private handoff is available when off.

Edge handlers signal immediately AFTER commit, best effort and nonblocking; failed signaling never
rolls back content/inbox. One-minute server recovery handles missed signals. Both paths share claims,
quotas and deduplication. Disabled mode makes no provider calls. Five-minute external inbox delivery
is conditional on eligible sender, provider availability and free allowance. Signals use dedicated
server-only secret; claim at most 20 rows/run and cap total daily email attempts at 100 across all
email categories. Never expose the service role or worker secret to the browser. Revalidate member
recipient before send; missing/revoked eligibility cancels the delivery. Worker operations are not
new user-change events and cannot recursively create notifications.

Provider interface: sendNotification({eventKey, recipientVerifiedEmail, actorDisplayName,
category, action, safeAppPath}) -> disabled | accepted(providerId) | rejected(code,retryable) |
unknown. Adapter renders fixed Vietnamese generic templates, never private titles/text/photo URLs.
Sender and recipient cannot be supplied by browser. Unknown network outcomes are stored durably.

Brevo adapter uses HTTPS transactional batch API's documented messageVersions shape (one partner
recipient) with headers.idempotencyKey. Persist stable UUID key before calling. Its documented
30-minute dedupe TTL bounds safe uncertain retries; beyond it reconcile or abandon rather than
resend. accepted means provider accepted, not inbox delivered. Delivery webhook, if added later,
requires an independently designed authenticated contract; no unauthenticated status endpoint.

Disabled adapter must perform no external network send, records disabled(reason), and leaves
in-app notification available. Enabling provider applies to new events only. Global budget
reservation occurs before external calls; rejected/unknown attempts still conservatively count.

## Configuration boundary

Browser build: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY only. Both are public by design;
RLS provides protection. No VITE_-prefixed service-role, Brevo, bootstrap, or worker secret.

Edge secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or server secret equivalent),
BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME, EMAIL_PROVIDER=disabled|brevo,
EMAIL_DELIVERY_ENABLED=false, EMAIL_SENDER_VERIFIED=false, WORKER_SECRET, OPERATION_SIGNING_KEY, OPERATION_SIGNING_KEY_ID,
APP_ORIGIN, EMAIL_DAILY_CAP=100. Operation signing keys stay server-only, never VITE_-prefixed.
Operator provisioning credentials never enter browser or Git. Auth SMTP configuration is separate
from the Brevo notification API; enabling the latter does not configure the former.

Netlify builds npm ci && npm run build, publishes dist; SPA fallback to index.html. Apply CSP
restricting connections/images to the actual Supabase origin, self and required blob display;
no inline untrusted scripts, no private source-map content, no analytics carrying private paths.
Production redirects allow only the exact app origin; preview builds must not access production
private data or inherit privileged environment settings.
