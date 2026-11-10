# Implementation Plan: Lover - Our Story MVP

**Branch**: `master` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: `specs/001-private-memory-website/spec.md`; user's free-tier planning constraints.
Setup script reported the feature identifier as BRANCH; actual Git branch is master and was not changed.

## Summary

Build a Vietnamese private React application for one couple using Vite, TypeScript, and Tailwind.
Netlify serves only the static application shell on HTTPS at a netlify.app address. Supabase Auth,
PostgreSQL with row-level security (RLS), private Storage, and Edge Functions enforce private access.
In-app partner notifications are durable and unconditional; optional Brevo transactional email is
OFF by default until sender eligibility and actual delivery are verified. No application code,
service provisioning, deployment, migrations, or tasks are produced in this planning phase.

The user has superseded the earlier self-and-partner email rule: only the other enrolled partner
receives a notification. The specification and requirements checklist are synchronized accordingly.

## Technical Context

**Language/Version**: TypeScript strict mode; Node 22.12+ build baseline; Supabase Deno Edge runtime.
Exact compatible stable package and CLI versions must be pinned in a lockfile during implementation.
**Primary Dependencies**: React, Vite, Tailwind with its Vite plugin, React Router, supabase-js,
Zod for boundary schemas, Temporal polyfill for date-only arithmetic. Avoid a separate state framework;
feature hooks and a small session context suffice for two users.
**Storage**: Supabase Free PostgreSQL and private staging/media buckets; private browser memory only
for loaded content. No persisted private query cache or offline service worker.
**Testing**: Vitest and React Testing Library; Playwright including keyboard/accessibility journeys;
SQL/RLS integration checks against local Supabase; Deno tests for Edge handlers/provider adapters.
**Target Platform**: Current mobile/desktop browsers, Vietnamese UI, 320px minimum width; Netlify Free
static hosting; Supabase Free backend. No purchased domain or server.
**Project Type**: Single frontend plus managed backend, not microservices.
**Performance Goals**: Spec SC-005: 95% initial views within 3s under stated network/load conditions;
keyset pagination of 30 items, lazy image fetching, bounded in-memory blob cache, compressed preview
variants charged against storage budget. No paid Supabase image transformations.
**Constraints**: Two accounts, author-only content mutation, private media, zero paid upgrades,
partner-only notifications, email disabled without verified sending eligibility. Free services may
pause or exhaust quotas: uninterrupted availability and unlimited photos are not promised.
**Scale/Scope**: One couple, seven MVP stories. 1,000 memories/2,000 photos is a performance fixture,
not a guarantee of unlimited capacity. All byte totals include stored compressed copies, variants/staging.

## Constitution Check

*Gate checked before research and rechecked after Phase 1 design; design compliance, not test results.*

| Principle | Pre-research commitment | Post-design evidence/result |
| --- | --- | --- |
| I TypeScript modules | Strict, focused modules | Feature folders and contracts: PASS |
| II React mobile-first | React + responsive views | 320px and desktop validation: PASS |
| III Romantic aesthetic | Shared palette/motion tokens | Vietnamese UI contract and reduced motion: PASS |
| IV Personal privacy | No private static assets/caches | RLS, private buckets, redacted payloads: PASS |
| V Authentication | Verify user on trusted boundaries | Auth/session contracts: PASS |
| VI Database/storage authorization | Deny by default | Separate RLS matrix and media access: PASS |
| VII Two users | Serialize membership writes | Couple row lock + slot constraints: PASS |
| VIII Unauthorized joining | Controlled bootstrap/invite | Hashed token, verified identity, no public sign-up: PASS |
| IX Input/uploads | Validate content, type, size | Staging/finalization, limits and tests: PASS |
| X Secrets | Server-only privileged configuration | Environment inventory and bundle scan: PASS |
| XI Interaction states | Explicit asynchronous states | UI and delivery states specified: PASS |
| XII Accessibility | Keyboard/contrast/reduced motion | Quickstart acceptance gates: PASS |
| XIII Simplicity | One app, one backend | SQL outbox, no extra paid queue: PASS |
| XIV Tests | Automated important behavior | Auth/RLS/races/uploads/dates/outbox test matrix: PASS |
| XV Spec Kit | Synchronize spec before design | Research, model, contracts, validation guide: PASS |
| XVI Focus | Plan only | No source changes or implementation: PASS |

## Project Structure

### Documentation (this feature)

```text
specs/001-private-memory-website/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/application.md
  checklists/requirements.md
```

`tasks.md` is intentionally reserved for `$speckit-tasks`.

### Source Code (repository root)

Planned paths only; do not use the nested `lover/` scaffolding as another application root.

```text
src/
  app/                 # router, session, Vietnamese shell
  components/          # accessible controls, state panels, viewer
  features/            # auth, home, timeline, gallery, diary, settings, notifications
  lib/                 # supabase public client, dates, validation, private image cache
  styles/              # Tailwind and design tokens
supabase/
  migrations/          # schema, grants, RLS, transactional routines, outbox
  functions/
    api/               # authenticated commands, invitations, uploads
    notification-worker/
    _shared/           # identity checks, schemas, replaceable mail adapter
  tests/               # SQL authorization and concurrency tests
  config.toml
tests/
  unit/
  integration/
  e2e/
netlify.toml           # future static build, SPA rewrite, security headers
```

**Structure Decision**: Root-level single frontend and Supabase backend. Existing nested scaffolding
is left untouched. No Netlify Functions, Netlify Identity, paid queue, custom domain, or SSR required.

## Complexity Tracking

No constitution exceptions required. SQL transactions, staging uploads, and a durable outbox are
necessary for membership races, untrusted media, and duplicate-resistant notifications respectively.

## Phase 0 - Research Decisions

See [research.md](research.md) for official references and decisions. Sender verification is an
operational release gate, resolved in the design by disabled external email, rather than an
unresolved architecture choice. All core functions work without email. Provider quotas are a dated
snapshot to be rechecked in account dashboards before deployment.

## Phase 1 - Architecture and Delivery Boundaries

### Access and writes

Browser signs in through Supabase Auth. Disable public signup; bootstrap the first account via a
local operator procedure using an admin credential outside the application. Use email/password so
login does not depend on outbound email. If transactional sender setup fails, operator-assisted
verified provisioning and a one-time invite token shared privately are supported; never auto-confirm
arbitrary emails. Verify control of both specified addresses out of band and document the operator's
confirmation before provisioning. No admin/bootstrap endpoint is exposed publicly.

Browser reads with its own access token under RLS. Mutations pass through authenticated Edge
commands into narrowly granted database routines so authorization, optimistic version checking,
operation idempotency, and outbox inserts commit together. Revoke generic browser DML where it could
bypass this path. User-callable routines derive actor from auth.uid(); service-only helpers receive
a server-verified actor, never trust caller-supplied IDs. Security-definer routines use fixed
search_path, minimal grants and explicit membership/ownership checks. No service-role read becomes
an authorization bypass. Resolve conflicts with HTTP 409 and safe refresh guidance.

### Media

Browser preparation accepts JPEG/PNG/WebP sources <=10 MiB and <=24 megapixels, checks headers
before decoding, applies orientation and produces a metadata-free JPEG with longest edge <=1600.
The compressed copy is the stored photograph; the full-resolution source is not retained. Explain
this before selection. Preparation runs sequentially and retains its resulting File for retries.
Reserve using the prepared bytes/type, then upload directly to private staging under an owner-specific
exact-path reservation. Browser preparation never grants trust: the Edge finalizer rechecks actual
bytes/type/dimensions and fully decodes the prepared image with a <=1600-by-1600 pixel budget.
Raw larger images are rejected before decoding, preventing the original 24 MP worker exhaustion.
Promote only validated copies/previews. No paid transformations or increased worker limits.
Test the browser-to-Edge path against the actual worker before publication is enabled.
Staging has no browser SELECT policy; no unvalidated bytes become viewable. Quota reservations
serialize bytes across concurrent batches. Expire pending uploads after one hour and clean up
orphaned objects through a bounded maintenance job.

Download using authenticated Storage requests plus SELECT policy requiring active membership and
ready photo metadata. Browser displays temporary object URLs, revoking them on logout/expiry.
Do not expose public or bearer signed URLs. Disable private caching; use no-store on private proxy
responses if a proxy is needed. Previously downloaded bytes cannot be revoked from a user's device;
logout must block new fetches and clear application-held content, not promise remote erasure.
Photo deletion marks metadata deleting immediately (denying reads), clears references transactionally,
and schedules retriable object cleanup; metadata is tombstoned until cleanup completes.

### Notification flow

Database commit writes one immutable change event and at most one recipient notification, selecting
the other current member. No partner means no recipient and no later replay of old events to a new
member. In-app inbox supports unread/read with category, actor, time, and authenticated deep link.
Load on navigation/focus and poll every 60 seconds only while visible; no realtime chat infrastructure.

Same transaction inserts an optional mail delivery row. Edge commands signal immediately after commit, best effort and nonblocking; a bounded Supabase
Cron invocation every minute recovers missed signals; also permits authenticated, rate-limited retry requests. Worker
endpoint accepts only its dedicated server secret, never a public anon token. Claim rows with locks
and leases; enforce unique(event_id, recipient_id, channel). Keep provider-independent send interface
and separate disabled/Brevo adapters. Secrets only in Edge environment. Disabled mode marks external
channel disabled while in-app content remains delivered; never silently promises pending mail.
When enabling email, send only new eligible events, not an unbounded historical backlog.

Provider timeouts after an uncertain acceptance become unknown, not blindly retried. Reuse provider
idempotency key inside documented deduplication window; beyond that window require reconciliation
or explicit abandon. Exactly-once external delivery cannot be guaranteed across all failures;
prevent duplicate app events and avoid automatic resends when acceptance is uncertain.

### Free-tier budgets and operations

Dated limits and sources are in research. Set internal media reservation cap at 800 MiB including
stored copies, previews and staging, DB alert at 350 MB and stop nonessential growth at 400 MB, daily
email cap at 100 (within Brevo's current free 300/day). Show quota-limited messages, permit reads,
deletes, and recovery operations as capacity allows. Cap logs to IDs/error codes, never text/media.
Use no paid add-ons or automatic upgrade; verify Free status in all dashboards. Operator checks
usage weekly and after batches/deployments; an application cannot hard-enforce external egress
or attack traffic usage with a local counter alone. Hosting/bandwidth exhaustion may pause service.

Keep relationship content until explicit change/deletion; prune operational events/inbox/deliveries
and closed-batch metadata after 90 days. Retain receipts through signed token expiry (30 days from
issuance) plus 24 hours; reject expired tokens even if their receipt has been removed. Keep no private text in event
history. Manual encrypted local backups include DB and media separately, rotate within 30 days,
and test restoration; do not assume a managed Free backup/PITR service.

### Sender release gate

Default EMAIL_PROVIDER=disabled and EMAIL_DELIVERY_ENABLED=false. An operator must verify Brevo
account eligibility, From-address verification, applicable domain authentication requirements,
actual successful delivery to the partner, and the account's free allowance before enabling.
A netlify.app website hostname supplies no sender-domain DNS control. No owned custom domain
means production email may remain unavailable indefinitely; the in-app system is the complete
fallback and authentication/enrollment must remain usable through the controlled procedure above.

### Validation and ordering

Implement later in story order: private setup/auth/RLS; core memories plus settings/date home;
gallery and diary; durable in-app notifications plus disabled/Brevo adapter and sender gate.
Outbox foundations must exist with the first content mutation, not be retrofitted after mutations.
See [data-model.md](data-model.md), [contracts/application.md](contracts/application.md), and
[quickstart.md](quickstart.md). Phase 1 constitution recheck passes with no exceptions. Do not
create implementation tasks until `$speckit-tasks` is invoked.


### Approved Remediation Design

- Enrollment has two command-specific pre-membership exceptions: operator-approved first identity
  may create the singleton only if absent, and verified invite recipient may accept. Ordinary
  commands require membership; neither exception permits private reads. Add first-run setup and
  invite create/revoke/copy screens.
- Foundation 0001_identity.sql creates identity tables/bootstrap eligibility and denial policies;
  0002_foundation.sql creates dependent budgets/receipts/outbox/helpers. Clean empty-database schema
  replay must pass before fixtures/US1. Later identity work extends policies/commands; media FKs wait.
- operation.issue authenticates and authorizes the command, rate-limits issuance, and signs random
  UUID/actor/command/canonical hash/server time/30-day expiry/key ID. Reauthorize and verify token
  before receipt lookup each attempt. Retain receipts until expiry +24h; never renew an old ID.
  Signing keys are server-only, verification keys cover outstanding tokens unless revoked. Token
  possession alone never grants access. Unchanged retries reuse envelope; changed payload gets new ID.
- Reserve returns stable batch/file IDs. Changed failed-file subsets get new command operations,
  successful file results are immutable under unique(batch_id,file_id). First success atomically
  creates one immutable batch event and optional current-partner notification/email. Later success
  updates a separate count/status summary without resetting read_at or sending another email.
  Generic email omits changing counts. No partner at first success means no later replay. Close
  explicitly or at one hour; no successful files means no notification; saved photos survive expiry.
- Every mutation signals only after commit. One-minute recovery shares leases, provider dedupe and
  daily budgets; disabled mode performs no provider calls. Baseline recovery <=1,440 invocations/day
  plus bounded immediate signals must fit Free monitoring. Five-minute external inbox target is
  conditional on sender/provider availability and free allowance, not an availability SLA.
- Settings/help explains persistent relationship content versus operational retention. All changes
  remain design-only and preserve Netlify/Supabase Free and optional replaceable email.

### I5, U3 and G2 contract synchronization

- Media migration order: 0010_upload_reservations.sql creates upload batches/files/reservations and
  helpers; 0011_storage_policies.sql then creates dependent object policies. T049 precedes T050;
  T011 clean empty-database replay verifies dependencies and uses no pre-existing tables.
- operation.issue requires actual intended command payload, resource IDs, expected_version and
  upload IDs when applicable. Authenticate actor, validate/canonicalize input, authorize exact
  intent/target, then hash server-side; client hashes never authorize. Recheck actual intent and
  authorization on execution. Tests cover modified/mismatched/unauthorized/expired operations;
  never log sensitive payloads or private content.
- A recipient-scoped inbox projection joins batch summary only for notification recipient who is
  still a member of the same couple, with matching notification/event/batch scope and event IDs.
  Expose only batch_id, success_count, failure_count and open/closed/expired status; raw batch/file
  data is not an inbox read surface. T049 backs the summary; T075 defines safe projection; T076
  consumes it. Test direct and cross-couple identifier changes, actor/outsider denial and allowed
  recipient updates. One notification/email per batch and stable read state remain unchanged.
