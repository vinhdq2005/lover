# Data Model

Design only: no migration SQL. IDs are UUIDs, timestamps UTC, event/relationship dates date-only.
Every mutable row has created_at, updated_at and integer version; stale version returns conflict.
All couple-scoped foreign keys must include couple_id to prevent cross-space associations.

## Entities and validation

| Entity | Fields and relationships | Invariants |
| --- | --- | --- |
| profiles | user_id -> auth.users, verified email reference, display_name, avatar_photo_id | Own profile updates only; name 1-100 code points; email never browser-editable |
| couples | id, name, start_date, first_meeting_date?, timezone, featured_photo_id?, version | Singleton deployment; valid IANA timezone; dates <= local today; first meeting <= start |
| memberships | couple_id, user_id, slot 1 or 2, joined_at | Unique user and unique(couple_id,slot); no client DML |
| invitations | id, couple_id, issuer_id, recipient_email, token_hash, expires_at, state | One active pending invite; 48h; never expose hash or enumerate recipient identities |
| memories | id, couple_id, creator_id, title, description, event_date, version | Title 1-200; description <=10,000; date <= local today; author mutation |
| photos | id, couple_id, uploader_id, storage_path, preview_path?, album_id?, description, event_date, bytes, format, state, version | Source JPEG/PNG/WebP <=10 MiB, <=24MP; stored compressed copy <=1600 longest edge, independently validated <=10 MiB; description <=2,000; immutable owner/path |
| memory_photos | couple_id, memory_id, photo_id, position | References same couple; readable ready photo; only memory author changes associations |
| albums | id, couple_id, creator_id, title, version | Title 1-200; creator renames/deletes; photos survive deletion |
| entries | id, couple_id, author_id, kind diary/letter, title, content, event_date, version | Title 1-200, content 1-50,000; author mutation; both read |
| milestones | id, couple_id, label, original_date, version | Label 1-200; both mutate; annual recurrence; derived day milestones not duplicated as rows |
| upload_batches | id, couple_id, owner_id, state, expires_at, event_id?, recipient_id?, success_count, failure_count | One-hour lifetime; open -> closed/expired; unique event; summary counts/status only |
| upload_files | batch_id, file_id, request_hash, photo_id?, state | Unique(batch_id,file_id); successful results immutable; failed/incomplete retry while open |
| upload_reservations | id, batch_id, couple_id, owner_id, operation_id, reserved_bytes, expires_at, state | <=20 files/batch; capacity row locked; one-hour expiry; no readable unvalidated objects |
| change_events | id, couple_id, actor_id, operation_id, category, action, resource_id?, created_at | Written transactionally by trusted routines; generic metadata, no private text; immutable |
| notifications | id, event_id, recipient_id, read_at?, created_at | Unique(event_id,recipient_id); recipient != actor; only other member at event commit |
| deliveries | id, notification_id, channel email, state, attempts, lease_until?, next_attempt_at?, provider_key, provider_message_id?, error_code? | Unique(notification_id,channel); no recipient email submitted by browser |
| operation_receipts | actor_id, operation_id, command, request_hash, result_reference, token_expires_at, purge_after | Unique(actor_id,operation_id); same key/different request conflicts; retain until token expiry +24h |
| usage_budget | scope, day?, reserved_bytes, committed_bytes, email_attempts | Server-only; serialize quota reservations; provider dashboard remains authority |
| notification_preferences | user_id, email_enabled default false, version | Own member read/write via signed command; in-app remains unconditional; no historical replay |

Strings are trimmed where appropriate and validated for required non-whitespace content; lengths use
Unicode code points. User content is plain text, not executable markup. Date order uses event_date,
created_at and ID descending; keyset cursors contain the full tuple. Date range endpoints inclusive.
Couple name uses name limit; custom milestone dates cannot be in the future at creation in this MVP.

Image preparation stores a compressed photograph, not a full-resolution source archive. Source
dimensions are client progress metadata and never authorize acceptance. Storage byte accounting,
reservation hashes and immutable per-file results use the actual prepared bytes, plus any server
preview. Reserve only after preparation, keep that File across retries, and never upload a raw source
as fallback. Finalizer independently verifies byte/type/dimension/decode bounds before publication.

## Migration dependency order

0001_identity.sql creates profiles/couples/memberships/invitations, server-owned operator-approved
bootstrap eligibility and minimal deny-by-default policies and recursion-safe membership helpers. 0002_foundation.sql then adds budgets,
receipts and identity-bound notification tables/helpers. Identity dependencies exist before outbox
foreign keys/helpers. Clean empty-database schema replay runs before fixtures/US1. Add media FKs
only with later media schema. Within media migrations, 0010_upload_reservations.sql creates
batches/files/reservations and required helpers before 0011_storage_policies.sql creates dependent
object policies; clean replay explicitly verifies this ordering.

## Membership lifecycle

Bootstrap operator creates exactly the first eligible identity, then user creates singleton couple
and slot 1 atomically. Creation checks server-owned first-account eligibility without membership
and locks singleton setup; arbitrary authenticated identities are denied. Invitation acceptance is
the only other pre-membership enrollment mutation; neither exception allows private reads. Slot-1 member may invite the second email. Before accepting, operator provisions
that verified identity if email-based enrollment is unavailable. Acceptance locks couple and invite
rows, verifies auth identity/email, token hash, expiry, vacant slot and unused invitation, then inserts
slot 2 and consumes invitation in one transaction. Unique constraints prevent race bypasses.
No membership self-update, transfer, or accepted-partner replacement in MVP. Bootstrap completion
cannot be reset from the browser. Admin provisioning plus invite acceptance is a resumable saga:
an unattached provisioned identity has zero couple access; retry never produces extra members.

## Authorization matrix

| Resource | SELECT | INSERT/UPDATE/DELETE |
| --- | --- | --- |
| Couple content/profiles | Active member of same space | Authenticated command with owner rule; own profile, shared couple/milestones |
| Memberships | Same-space members | Only locked enrollment routine; immutable through generic data API |
| Invitation metadata | Issuer sees safe status | Issuer may create/revoke; acceptance only intended verified user |
| Notifications | Current same-couple member matching recipient_id only | Server inserts; recipient marks own read only |
| Inbox upload summary projection | Current member + notification recipient; matching notification/event/batch couple IDs and event reference | Server updates summary; browser read-only; expose only batch_id, success_count, failure_count, open/closed/expired status |
| Raw upload batches/files | No generic browser SELECT; owner-scoped status command for own progress | Trusted handlers only; inbox access uses minimal recipient projection, not raw rows |
| Events/outbox/budgets/receipts | No generic browser grants | Server-only; safe operation status projected by command |
| Staging objects | No browser reads | Reservation owner can insert exact allocated path; finalizer/cleanup server only |
| Ready media | Active member + ready matching metadata | Server promotion/deletion only; owner verified before action |

All exposed tables enable RLS and explicit grants. Disallow anonymous access. Never rely on couple_id
from a request; resolve membership. Apply both USING and WITH CHECK where applicable. Restrict
security-definer routines with fixed search_path and explicit ownership checks; test recursion-free
membership helpers. Cross-couple composite foreign keys remain enforced even for privileged writes.

## State transitions and atomicity

- Invitation: pending -> accepted/revoked/expired; terminal states never reusable.
- Upload/photo: reserved -> staged -> validated -> ready; failures -> rejected/expired -> cleanup.
  Publish metadata only after byte validation and successful promotion. Storage is not transactional
  with PostgreSQL: promotion failures leave unreadable orphans; reconciliation removes them.
- Delete: ready -> deleting (deny reads, clear memory/profile/featured links) -> deleted after
  retriable Storage removal. Memory deletion clears associations but does not delete photos.
- Mutation: verify member/owner -> compare version -> apply change -> event + partner notification
  + delivery disposition + receipt in one transaction. No changes means no event. Batch finalization
  uses stable batch/file identities: first success creates the only event and optional partner
  notification/email; later successes update separate summary, not immutable event or read_at.
  Changed retry subsets use new signed command operations; exact retries retain envelopes. Close
  explicitly or at one hour; successful files stay saved and zero-success batches never notify.
- In-app: unread -> read by recipient only. No partner at commit means no notification, including
  when an invited user later joins. Editing actor never receives their own notification.
- Email: disabled OR pending -> leased -> accepted/failed/deferred_quota/unknown; accepted is not
  delivered. Optional delivery reconciliation may mark delivered/bounced only on trusted evidence.
  Leases expire for retries only where acceptance is known not to have occurred. Unknown acceptance
  is never blindly retried beyond provider idempotency TTL. Five attempts maximum with bounded backoff.
- Issuance accepts actual intended payload with resource IDs, expected_version and applicable
  upload IDs; authenticate, validate/canonicalize, authorize target, then hash server-side. Never
  trust client hashes or log sensitive payloads. Execution rejects modified/mismatched intent.
- Signed operations bind actor/command/hash/server time/30-day expiry/key ID; validate before
  receipts and reauthorize each attempt. Retain receipts through token expiry +24h. Expired replay
  still fails after cleanup; rate-limit issuance and never treat a token as membership.
- Relationship content persists until explicitly changed/deleted. Prune operational events/inbox/
  deliveries and closed batch summaries after 90 days, not ready photos. Minimal inaccessible
  cleanup tombstones survive until deletion succeeds. Application-managed encrypted backups rotate
  within 30 days, including media exports.
- Immediate post-commit dispatch and one-minute recovery share claims, budgets and deduplication;
  unavailable sender/provider/allowance degrades only email, never saved content or in-app delivery.
