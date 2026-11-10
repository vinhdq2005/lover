# Quickstart and Validation Guide

Implementation validation uses the marked disposable lover-integration project only. Commands
that provision hosted services, reset development or activate real email are operator-only and
must not be executed as part of automated acceptance.

## Prerequisites

Node 22.12+, npm, Supabase CLI, Docker for local Supabase, two known test identities and an outsider.
Netlify and Supabase Free accounts; Brevo Free optional. No custom domain required. Pin dependency
versions/lockfile during implementation. Never use real relationship data in local fixtures.

## Disposable automated validation setup

From repository root:

```powershell
npm ci
npm run test:integration
```

The command guards and starts lover-integration on 55321/55322, cleanly replays migrations and
executes SQL assertions before tests. Browser commands use this disposable project and synthetic
identities. Never run database suites concurrently or substitute a development or linked project.
For manual development, apply pending migrations to an existing local database without reset,
configure ignored public .env.local and server-only .env.edge.local, then npm run dev.
Controlled identities use docs/operator-enrollment.md. No real mail is needed for validation.

## Validation commands

```powershell
npm run typecheck
npm run lint
npm run test -- --run
npm run test:integration
npm run test:edge
npm run test:e2e
npm run test:performance
npm run build
npm run check:build
```

SQL assertions run as integration/browser prerequisites. Record actual outcomes rather than treating this guide
as test evidence. Bundle inspection must confirm no privileged secrets/private fixture content.

## Acceptance matrix

1. **US1 / FR-001..006**: Disable public signup; first operator identity creates one couple;
   invited verified partner joins. Wrong email, replay, expiry, simultaneous accepts and third
   identity fail. Test direct Data API, RPC, Edge and Storage requests as anon/outsider/expired token.
   Never make the partner an infrastructure team admin just to receive Auth email.
2. **US2 / FR-011..012,026**: Create text/photo memory, date filters and month/year groups,
   author edit/delete, partner read-only mutation failure. Retry same operation; verify one memory
   and one event. Submit stale version and confirm 409 plus preserved local correction text.
3. **US3 / FR-007..010**: Frozen-date tests cover day zero, couple-local midnight, device timezone,
   daylight savings, Feb 29, 100 and 365 days, annual vs day milestones, first-meeting counter,
   changed timezone/start date, no photo/recent-memory/upcoming state.
4. **US4 / FR-013..016**: Mixed batch valid JPEG/PNG/WebP, disguised type, >10 MiB, >24MP,
   invalid decode and interrupted upload. Prepare valid sources in browser to <=1600-longest-edge
   compressed JPEGs before reservation; retain prepared Files for retries, explain that sources are
   not archived, and never fall back to raw uploads. Run `npm run test:image-runtime` with Vite and
   local functions running: verify the prepared 24 MP case passes and direct raw bypass returns 422.
   Verify per-file results, no staging read, safe retry,
   reservation races, 800 MiB cap, orphan cleanup and private preview. Owner vs partner deletion,
   album delete keeps photos; photo delete clears featured/profile/memory references.
5. **US5/6 / FR-017..019**: Vietnamese/emoji round-trip, limits and whitespace rejection,
   escaped script-like content; own profile only; both edit shared dates/milestones;
   diary author-only edits, shared reads, stale edit detection.
6. **US7 / FR-023..025**: Actor A mutation creates exactly one B inbox item and zero A items;
   reverse direction too. No partner/no-op/failure creates no item. Disable email and confirm
   full in-app experience plus disabled reason. Concurrent workers and repeated operation keys
   cannot duplicate notifications. Simulate accepted response loss: within 30-minute dedupe
   window reuse key; outside it stop for reconciliation, no automatic duplicate send.
7. **Email release gate**: Verify real Brevo sender status and domain rules without assuming
   netlify.app DNS control. If unavailable, leave provider disabled and test manual invitation
   handoff/password login/operator recovery. If eligible, send generic test to only the partner,
   verify no private titles/images in mail, secret never in client, and daily cap fails closed.
   Simulate 429, quota depletion, rejection and timeout; content/in-app delivery must persist.
8. **UX / FR-020..022 / SC-005..010**: 320px mobile and desktop, keyboard controls, focus return
   from viewer, reduced motion, readable contrast, accessible status messages; loading, empty,
   success/error and quota states in Vietnamese. Test logout/back navigation and session expiry
   clearing private views/object URLs. Measure stated 1,000-memory/2,000-small-image fixture at
   10 Mbps/100 ms; stay within fixture byte cap and record 95th percentile initial-view timing.

## Free deployment checklist for later execution

- Verify all account plans remain Free; no paid add-ons, auto recharge or domain purchase.
- Review current limits against [research](research.md); keep operation margins and document usage.
- Netlify: npm ci/build, dist, HTTPS netlify.app, SPA rewrite/security headers; deploy previews do
  not receive production private-data configuration. Budget builds/requests against free credits.
- Supabase: migrations/grants/RLS and private buckets first; signup disabled; exact redirect origins;
  deploy authenticated functions, bounded worker schedule, and server secrets. Verify policies
  independently with direct requests before uploading personal photographs.
- Keep EMAIL_DELIVERY_ENABLED=false until sender gate passes. Never use an invented From domain.
- Test encrypted DB and media export/restore; rotate local backups <=30 days. Weekly operator
  usage review; free-tier pause/outage means degraded availability, not permission to upgrade.

## Evidence to retain

Record automated results, direct-access denial matrix, concurrent joins/updates/outbox outcomes,
mobile/keyboard walkthroughs, timing measurements, quota screenshots without secrets, sender-gate
outcome and restore evidence. No deployment, implementation or tests have occurred in this phase.


## Approved remediation validation additions

- Run isolated empty-database schema replay before fixtures: identity precedes outbox foreign keys/helpers.
- Test first-run setup and invitation create/revoke/copy UI; arbitrary identity cannot bootstrap,
  intended verified recipient can accept, neither exception grants private reads before membership.
- Test signed operation tampering/expiry/cross-actor/command/hash misuse, revoked keys, concurrent
  exact retry and expired replay after receipt cleanup. Changed payload requires a new issued ID.
- Retry only failed files under same batch/file IDs with new command for changed subset; replay
  lost responses, race finalizers, close/expire batches; saved photos persist, one notification/email
  remains and read state stays unchanged. Zero successes/no partner never retrospectively notify.
- Test 90-day operational cleanup and receipt-expiry-plus-24h purge without deleting relationship
  data; check retention help and application-managed <=30-day backup rotation.
- Test immediate post-commit signal failure and one-minute recovery sharing claims/quotas. Measure
  five-minute inbox delivery only with sender eligibility, provider availability and free allowance;
  disabled email makes no provider calls and preserves content/in-app delivery.

## I5/U3/G2 regression checks

- Replay clean schema and assert 0010_upload_reservations.sql precedes 0011_storage_policies.sql,
  with all reservation tables/helpers present when object policies are created.
- Issue operations using actual intended payload/resource/version/upload IDs. Verify unauthorized
  targets, mismatched/modified execution payloads, substituted client hashes and expired tokens
  are rejected; inspect test logs for absence of private inputs, canonical content and tokens.
- As intended current same-couple recipient, read only batch reference/counts/status from inbox.
  Test anon, outsider, actor/wrong recipient, altered batch/notification ID and cross-couple joins;
  no raw file/path/intent data may leak. Retry partial batches: same notification/read state and
  email count, updated recipient summary. Owner progress access never grants partner-inbox access.
