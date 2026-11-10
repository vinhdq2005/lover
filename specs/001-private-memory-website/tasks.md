# Tasks: Lover - Our Story MVP

**Input**: `specs/001-private-memory-website/` spec, plan, research, data model, contracts and quickstart.
**Prerequisites**: Approved design artifacts and constitution v1.1.0.
**Tests**: Required by constitution XIV and plan; write story tests first, observe expected failures,
then implement and rerun. A task is complete only with recorded validation evidence.
**Organization**: Story IDs remain those in spec.md. P1 order is US1 -> US3 -> US2 to prioritize the
counter before timeline as requested. P2 order is US4 -> US5 -> US6 -> US7; interface polish is last.

## Format: `[ID] [P?] [Story] Description`

All tasks start unchecked. [P] means a task can run alongside its explicitly named peer after their
shared prerequisites are complete; it does not authorize skipping earlier dependencies or spawning
agents. Story labels apply only within story phases. Paths are relative to repository root.

## Path Conventions

Use root `src/`, `supabase/`, `tests/`, and `scripts/`. Leave duplicate `lover/` scaffolding untouched.
Migrations use increasing filenames listed below. Shared contracts are in
`specs/001-private-memory-website/contracts/application.md`; data constraints there and in the model
are mandatory. Do not deploy or provision hosted accounts merely to complete local code tasks.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Reproducible React/TypeScript/Vite development and test tooling.

- [X] T001 Initialize root React/TypeScript/Vite application in package.json, package-lock.json, index.html, tsconfig.json and src/main.tsx; pin compatible versions and Node 22.12+ without overwriting Spec Kit files.
- [X] T002 Configure Tailwind Vite integration and strict TypeScript/lint commands in vite.config.ts, src/styles/index.css and eslint.config.js; install planned router, Supabase client, Zod and Temporal dependencies.
- [X] T003 Configure Vitest/React Testing Library, Playwright and Deno test commands in vitest.config.ts, playwright.config.ts, supabase/functions/deno.json and package.json so every quickstart validation command has an executable script.
- [X] T004 [P] Initialize local Supabase configuration in supabase/config.toml with public/anonymous signup disabled, local Auth URLs and separate API/worker authorization settings; peer T005 after T003.
- [X] T005 [P] Define secret-safe examples and ignore rules in .env.example, .env.edge.example and .gitignore; browser allows only public URL/publishable key; EMAIL_PROVIDER=disabled and EMAIL_DELIVERY_ENABLED=false; peer T004 after T003.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Security and transactional infrastructure before any private story.
**Checkpoint**: All foundation tests pass before US1; no private resource defaults to public.

- [X] T006 Add synthetic two-member/outsider fixtures and local reset helpers in tests/helpers/identities.ts and supabase/seed.sql; use no real relationship content or production credentials.
- [X] T007 [P] Add boundary tests in tests/unit/validation.test.ts for Unicode code-point lengths, whitespace rejection, plain-text rendering values, invalid dates and operation IDs; peer T008 after T006.
- [X] T008 [P] Add command security contract tests in supabase/functions/tests/boundary.test.ts for 400/401/403/404/409/413/415/422/429/503 responses, redaction and untrusted actor/recipient fields; peer T007 after T006.
- [X] T009 Implement shared boundary schemas in supabase/functions/_shared/validation.ts and src/lib/validation.ts with required non-whitespace strings, Unicode lengths, UUID operation IDs and server-owned scope/identity fields excluded from client input.
- [X] T010 Implement JWT verification, exact-origin CORS, no-store errors and redacted logging in supabase/functions/_shared/auth.ts, supabase/functions/_shared/http.ts and supabase/functions/api/index.ts; CORS never substitutes for authorization.
- [X] T011 Write isolated clean empty-database schema replay prerequisite in tests/integration/global-setup.ts, tests/integration/migrations.test.ts and vitest.integration.config.ts; use the marked disposable lover-integration project only; identity precedes notification foreign keys/helpers, fixtures load afterward, initially observe missing-schema failure, then rerun after the foundation migrations and after every later migration; explicitly assert 0010_upload_reservations.sql precedes 0011_storage_policies.sql and that every reservation table/helper referenced by storage policies already exists; fail on dependency errors.
- [X] T012 Create identity tables/bootstrap eligibility in supabase/migrations/0001_identity.sql with denial grants and recursion-safe membership helpers, "name 1-100 code points", singleton couple, "Unique user and unique(couple_id,slot); no client DML", and one pending 48-hour invite; defer media FKs.
- [X] T013 Define timestamp/version conventions, operation receipts and usage budgets in supabase/migrations/0002_foundation.sql: "Unique(actor_id,operation_id); same key/different request conflicts; retain until token expiry +24h" and "Server-only; serialize quota reservations; provider dashboard remains authority"; reject expired retries.
- [X] T014 Define change_events, notifications and deliveries plus server-only transactional emission helper in supabase/migrations/0002_foundation.sql: "Written transactionally by trusted routines; generic metadata, no private text; immutable", "Unique(event_id,recipient_id); recipient != actor; only other member at event commit" and "Unique(notification_id,channel); no recipient email submitted by browser"; start email disabled; membership checks use the already-created foundation helper.
- [X] T015 Add SQL tests for rollback-safe event/receipt insertion, duplicate operation IDs and no-partner/no-op behavior in supabase/tests/foundation.test.sql; verify generic browser DML on server tables is denied and notification history carries no private text.
- [X] T016 Add operation tests in supabase/functions/tests/operations.test.ts and supabase/tests/operations.test.sql for mismatched/modified payload, resource/version/upload identifiers, unauthorized issuance/execution, client-hash substitution, tampering/cross-actor/command misuse, expired operation after receipt purge, revoked keys, concurrent exact retries and payload conflicts; token alone grants no access and sensitive payloads never appear in logs.
- [X] T017 Implement authorized rate-limited operation.issue/signature checking in supabase/functions/api/operations.ts and supabase/functions/_shared/operations.ts requiring actual intended command payload, resource IDs, expected_version for existing mutations and upload IDs where applicable; authenticate actor, validate/canonicalize intent, authorize its target, compute hash server-side (never authorize from client hashes), bind actor/command/hash/server time/30-day expiry/key ID and redact payloads; validate before receipts, reauthorize each attempt, retain receipts until expiry +24h, server-only keys in .env.edge.example.
- [X] T018 Implement public-config validation, access-token client, idempotent command client and private-session cleanup registry in src/lib/supabase.ts, src/lib/commands.ts and src/lib/privateSession.ts; retain operation IDs on retry and clear private state on expiry/logout.
- [X] T019 Create Vietnamese accessible loading/error/empty/confirmation primitives in src/components/StatePanel.tsx and src/components/ConfirmDialog.tsx; include labeled controls, visible focus, status announcements and safe unsaved-text recovery during an active session.

## Phase 3: User Story 1 - Establish and Access Our Private Space (Priority: P1)

**Goal**: Secure two-account enrollment, login/logout and database authorization before feature data.
**Independent Test**: Controlled local operator provisions A/B; A creates the space and invites B;
wrong recipient, expired/revoked/replayed invite, simultaneous third join and direct outsider access fail.
**Coverage**: FR-001..006, FR-020..022; SC-001..002.

### Tests for User Story 1

- [X] T020 [P] [US1] Write Auth/enrollment command contract tests in supabase/functions/tests/enrollment.test.ts covering invalid sessions, invitation binding/revocation/48-hour expiry and recovery without outbound email; peer T021 after T019.
- [X] T021 [P] [US1] Write identity/RLS and concurrent enrollment tests in supabase/tests/membership.test.sql and tests/integration/enrollment-race.test.ts covering raw Data API/RPC bypasses, immutable membership and max-two race; peer T020 after T019.

### Implementation for User Story 1

- [X] T022 [US1] Verify/extend foundational profiles, singleton couples, memberships and invitations without recreating tables in supabase/migrations/0003_identity.sql with "Own profile updates only; name 1-100 code points; email never browser-editable", "Singleton deployment; valid IANA timezone; dates <= local today; first meeting <= start", "Unique user and unique(couple_id,slot); no client DML", and "One active pending invite; 48h; never expose hash or enumerate recipient identities"; avatar/featured references remain nullable until media migration.
- [X] T023 [US1] Implement recursion-safe member helpers, RLS and minimal grants in supabase/migrations/0004_identity_policies.sql; same-space reads, own-profile updates only through commands, no client membership writes, fixed search_path and explicit checks on privileged routines.
- [X] T024 [US1] Implement operator-only provisioning/recovery tooling in scripts/provision-user.ts and docs/operator-enrollment.md; verify mailbox control out of band, bootstrap once, allow only the two intended identities, keep admin credentials off browser and never log passwords.
- [X] T025 [US1] Implement singleton creation and locked invitation create/revoke/accept routines in supabase/migrations/0005_enrollment_commands.sql; hash random one-use tokens, verify matching identity and vacant slot, consume atomically, resume safe provisioning failures without extra members.
- [X] T026 [US1] Add authenticated enrollment handlers in supabase/functions/api/enrollment.ts using foundation envelopes and receipts; support private handoff when email disabled; only approved first identity without a space may create singleton and only intended verified identity may accept; ordinary commands require membership, no public bootstrap endpoint.
- [X] T027 [US1] Implement password login/logout, protected routes and invite acceptance in src/features/auth/LoginPage.tsx, src/features/auth/InvitePage.tsx, src/app/SessionProvider.tsx and src/app/router.tsx; generic login errors, no unrestricted registration, clear private state on session loss.
- [X] T028 [US1] Add setup/invitation journeys in tests/e2e/setup.spec.ts for approved identity, outsider denial, singleton race, revoke/copy/private handoff and matching recipient acceptance without email.
- [X] T029 [US1] Build first-run name/date/timezone setup and invitation create/revoke/copy UI in src/features/auth/SetupPage.tsx and src/features/auth/InvitationPanel.tsx; wire src/app/router.tsx, deny arbitrary-account setup and private reads before membership.
- [X] T030 [US1] Verify the full private enrollment journey, logout/back navigation and expired-session clearing in tests/e2e/auth.spec.ts; record US1 acceptance outcomes in specs/001-private-memory-website/validation/us1.md.

## Phase 4: User Story 3 - Relationship Counter and Home (Priority: P1)

**Goal**: Deliver usable calendar-day counters before timeline or uploads.
**Independent Test**: With seeded identity only, edit dates/timezone and verify day zero, local midnight,
resume, leap years, first meeting and annual/day milestones. Home works with placeholders before US2/US4.
**Coverage**: FR-007..010, FR-018 date/milestone subset; SC-004.

### Tests for User Story 3

- [X] T031 [P] [US3] Write fixed-clock date tests in tests/unit/relationshipDates.test.ts for timezone/device differences, DST, start-day zero, Feb-29 -> Feb-28 recurrence, day 100/365 versus yearly anniversaries, first meeting and next-three ties; peer T032 after US1.
- [X] T032 [P] [US3] Write settings/milestone command tests in supabase/functions/tests/relationship.test.ts for invalid/future dates, meeting-after-start, shared edits, stale versions and one partner event; peer T031 after US1.

### Implementation for User Story 3

- [X] T033 [US3] Create milestones and relationship-setting routines in supabase/migrations/0006_relationship.sql: "Label 1-200; both mutate; annual recurrence; derived day milestones not duplicated as rows"; valid IANA timezone, optional first meeting <= required start <= local today; custom original dates <= today; shared changes emit transactional events.
- [X] T034 [US3] Implement Temporal date arithmetic and scheduled midnight/resume refresh in src/lib/relationshipDates.ts and src/features/home/useRelationshipCounter.ts; no duration-in-milliseconds day counting and no paid service dependency.
- [X] T035 [US3] Expose versioned relationship/milestone commands in supabase/functions/api/relationship.ts and a date-only settings form in src/features/settings/RelationshipSettings.tsx with Vietnamese validation and 409 reconciliation.
- [X] T036 [US3] Build initial home/counter in src/features/home/HomePage.tsx and src/features/home/MilestoneList.tsx showing names, placeholder photos, separately labeled counters and next three occurrences; missing recent memories and featured media are guided empty states until later integrations.
- [X] T037 [US3] Run date editing, midnight/resume and empty-home journeys in tests/e2e/counter.spec.ts; record fixed-clock/keyboard results in specs/001-private-memory-website/validation/us3.md.

## Phase 5: User Story 2 - Memory Timeline (Priority: P1)

**Goal**: Save and browse text-first memories; optional media integrates after secure uploads.
**Independent Test**: Create several dated memories as each partner, filter inclusive dates, verify
month/year order, owner-only edits/deletes, stale versions and retry deduplication without any photos.
**Coverage**: FR-011..012, FR-019..020, FR-026; SC-003 and timeline portion of SC-005.

### Tests for User Story 2

- [X] T038 [P] [US2] Write memory command tests in supabase/functions/tests/memories.test.ts for payload limits, author rules, missing IDs, retries, no-op changes, stale edits and atomic event creation; peer T039 after US3.
- [X] T039 [P] [US2] Write direct memory RLS and inclusive keyset filter tests in supabase/tests/memories.test.sql with outsider and partner-write denial, reversed ranges and equal-date ties; peer T038 after US3.

### Implementation for User Story 2

- [X] T040 [US2] Create memories, composite scope keys and versioned CRUD in supabase/migrations/0007_memories.sql: "Title 1-200; description <=10,000; date <= local today; author mutation"; optional description, required title/date/creator, UTC timestamps, fixed search_path, author checks and same-transaction receipt/event.
- [X] T041 [US2] Add member-only memory SELECT policies and event_date/created_at/id indexes in supabase/migrations/0008_memory_reads.sql; generic browser mutation denied, inclusive filter and stable descending keyset order, page 30/max 50.
- [X] T042 [US2] Implement memory CRUD handlers in supabase/functions/api/memories.ts and read/command hooks in src/features/timeline/useMemories.ts; preserve operation identity and return safe conflicts without private existence leakage.
- [X] T043 [US2] Build text memory form, owner confirmation controls, month/year timeline and date filters in src/features/timeline/MemoryForm.tsx and src/features/timeline/TimelinePage.tsx; Unicode-safe plain text, recoverable save text and empty/error/loading states.
- [X] T044 [US2] Add five recent memories to src/features/home/RecentMemories.tsx and wire src/features/home/HomePage.tsx using real member-scoped reads without changing relationship calculations.
- [X] T045 [US2] Verify browser create/filter/edit/delete in tests/e2e/timeline.spec.ts, concurrent submission/logout cleanup in tests/unit/commands.test.ts, and stale edits/replayed creates in supabase/tests/memories.test.sql; record outcomes in specs/001-private-memory-website/validation/us2.md.

## Phase 6: User Story 4 - Private Uploads and Gallery (Priority: P2)

**Goal**: Validate bytes before publishing images, then albums and safe timeline photo integration.
**Independent Test**: Mixed batch valid/disguised/oversized/interrupted files yields per-file outcomes;
staging cannot be read, only ready media is member-readable, and uploader permissions hold directly.
**Coverage**: FR-013..016, image subset FR-019, FR-022, FR-026; SC-006.

### Tests for User Story 4

- [X] T046 [P] [US4] Add image-byte validation/resource tests in supabase/functions/tests/images.test.ts, tests/e2e/image-preparation.spec.ts and scripts/check-image-runtime.mjs: JPEG/PNG/WebP sources <=10 MiB/24 MP, browser preparation to <=1600 longest edge, corruption/spoofing/animation rejection, independent bounded Edge decoding/previews, and raw oversized decode bypass denial; actual local worker gate passed; peer T047 after US2.
- [X] T047 [P] [US4] Add storage-policy, reservation-race and cross-space association tests in tests/integration/storage.test.ts and supabase/tests/media.test.sql; staging SELECT denied, ready metadata required, no public/signed URL bypass; peer T046 after US2.

### Implementation for User Story 4

- [X] T048 [US4] Create albums, photos and memory_photos in supabase/migrations/0009_media.sql: "Title 1-200; creator renames/deletes; photos survive deletion", "Sources JPEG/PNG/WebP <=10 MiB/24MP; stored prepared copy <=1600 longest edge, independently decoded <=10 MiB; description <=2,000; immutable owner/path", and "References same couple; readable ready photo; only memory author changes associations"; optional album, required photo date, at most one album/photo, attach nullable own-avatar and same-space featured FKs.
- [X] T049 [US4] Create upload_batches/upload_files schema and reservation/capacity routines in supabase/migrations/0010_upload_reservations.sql with stable batch/file IDs, unique(batch_id,file_id), immutable successful results and separate mutable count/status summary with a recipient-authorized inbox projection defined in contracts/application.md (same-couple current member + notification recipient only, no raw batch/file/path disclosure): "<=20 files/batch; <=10 MiB/file; atomic capacity reservation; opaque allocated paths" and "<=20 files/batch; capacity row locked; one-hour expiry; no readable unvalidated objects"; cap all staging/original/preview bytes at 800 MiB with locked usage counters.
- [X] T050 [US4] Create private staging/media buckets and policies in supabase/migrations/0011_storage_policies.sql; reservation-owned exact-path inserts, no staging reads, ready member reads only, server-only promotion/delete, bucket size/type constraints and no public objects. Depends on T049 reservation tables; run clean schema replay before proceeding.
- [X] T051 [US4] Implement bounded actual-byte inspection, decode validation and preview generation in supabase/functions/_shared/images.ts; source selection <=24MP, browser preparation in src/lib/prepareImage.ts to <=1600 longest edge, independent server header/decode checks, sequential processing and no paid transformations; reverify runtime budget with finalizer integration before publication. The real 24 MP browser-to-finalizer resource gate passed on 2026-11-09; see validation/us4.md.
- [X] T052 [US4] Implement reserve/stage/finalize handlers in supabase/functions/api/uploads.ts with prepared-byte recheck (never trust browser metadata), compensating orphan cleanup, per-file outcomes, stable server batch/file IDs, unique(batch_id,file_id), new signed operation for changed failed subset and exact-envelope retry; first success creates only event/inbox/email, later successes update separate summary without read reset/resend; explicit/one-hour closure.
- [X] T053 [US4] Add partial-batch lifecycle tests in tests/integration/upload-retries.test.ts for failed-only retry, immutable successes, lost responses, changed subset/new operation, concurrent finalization, close/expiry and one batch event/inbox/email with preserved read state; defer live recipient-projection assertions to T073/T083 after T075; US4 verifies only batch/event row integrity and raw batch access denial.
- [X] T054 [US4] Implement photo/album metadata mutation and deleting tombstones in supabase/migrations/0012_media_commands.sql and supabase/functions/api/media.ts; uploader/creator-only writes, either album may hold own uploads, clear profile/featured/memory references on photo deletion, album/memory deletion retains photos.
- [X] T055 [US4] Implement expiry/orphan/deleting-object cleanup in supabase/functions/maintenance/index.ts and bounded scheduling in supabase/migrations/0013_media_maintenance.sql; release reservations, reconcile object/DB mismatches and retry storage deletion without exposing tombstones.
- [X] T056 [US4] Implement upload selection/progress/retry UI in src/features/gallery/UploadPanel.tsx and src/features/gallery/useUploads.ts; enforce 20-file selection; prepare sequentially before reservation using src/lib/prepareImage.ts, explain compressed-copy storage, reserve prepared bytes/type, keep each prepared File stable for retries, fail without raw fallback; per-file outcomes, capacity feedback and no duplicate completed upload on retry.
- [X] T057 [US4] Implement authenticated blob loading, bounded memory cache and logout revocation in src/lib/privateImages.ts; no persistent private cache, public URLs or bearer signed links.
- [X] T058 [US4] Build album grid, full-screen keyboard viewer, description/date edits and owner deletion in src/features/gallery/GalleryPage.tsx and src/features/gallery/PhotoViewer.tsx with focus return and accessible progress/status.
- [X] T059 [US4] Integrate optional ready photo associations into src/features/timeline/MemoryForm.tsx and src/features/timeline/MemoryPhotos.tsx; add src/features/home/FeaturedPhoto.tsx and wire src/features/home/HomePage.tsx after validated media is available.
- [X] T060 [US4] Run batch partial failure, retry, owner denial, delete-reference cleanup, gallery/viewer and timeline-photo journeys in tests/e2e/gallery.spec.ts; record runtime/quota/direct-storage evidence in specs/001-private-memory-website/validation/us4.md.

## Phase 7: User Story 5 - Shared Diary and Letters (Priority: P2)

**Goal**: Shared readable entries with author-only mutation.
**Independent Test**: Both users create Vietnamese diary/letter entries and read each other's;
partner edits fail and author edits/deletion preserve chronology and conflict behavior.
**Coverage**: FR-017, FR-019..020, FR-026; text portion SC-003/009.

### Tests for User Story 5

- [X] T061 [P] [US5] Add diary/letter command tests in supabase/functions/tests/entries.test.ts for kind/title/content/date constraints, shared visibility, author writes and receipt/event behavior; peer T062 after US4.
- [X] T062 [P] [US5] Add diary RLS/Unicode tests in supabase/tests/entries.test.sql for outsider/partner mutation denial, code-point length and stable chronological ordering; peer T061 after US4.

### Implementation for User Story 5

- [X] T063 [US5] Create entries, policies and versioned CRUD in supabase/migrations/0014_entries.sql: "Title 1-200, content 1-50,000; author mutation; both read" and "kind diary/letter"; required author/date, date <= local today, same-space reads, no secret-author mode and transactional notifications.
- [X] T064 [US5] Add entry commands and reads in supabase/functions/api/entries.ts and src/features/diary/useEntries.ts with idempotency, stale version handling and stable descending date pagination.
- [X] T065 [US5] Build shared entry list/detail/editor in src/features/diary/DiaryPage.tsx and src/features/diary/EntryForm.tsx with Vietnamese states, plain-text Unicode rendering, ownership controls and confirmed deletion.
- [X] T066 [US5] Run diary/letter create/read/edit/delete and hostile-text journeys in tests/e2e/diary.spec.ts; record results in specs/001-private-memory-website/validation/us5.md.

## Phase 8: User Story 6 - Profiles and Shared Settings (Priority: P2)

**Goal**: Complete profiles/settings without duplicating date functionality from US3.
**Independent Test**: Each user edits only their profile; either edits shared couple settings;
valid ready photos appear across home/authorship and stale updates fail safely.
**Coverage**: FR-018..019 and US6 portion FR-006/026.

### Tests for User Story 6

- [X] T067 [P] [US6] Add own-profile/shared-couple command contract tests in supabase/functions/tests/settings.test.ts for versioning, 1-100 name limits, foreign avatar/featured references and no-op notification suppression; peer T068 after US5.
- [X] T068 [P] [US6] Add settings component tests in tests/unit/settings.test.tsx for Vietnamese forms, partner profile denial, image selection and relationship-form reuse; peer T067 after US5.

### Implementation for User Story 6

- [X] T069 [US6] Implement profile/couple commands in supabase/migrations/0015_profiles_settings.sql and supabase/functions/api/settings.ts with "Own profile updates only; name 1-100 code points; email never browser-editable"; optional own-uploaded avatar, shared couple name 1-100 and same-space ready featured photo, optimistic conflicts and partner event.
- [X] T070 [US6] Build settings/profile forms in src/features/settings/SettingsPage.tsx and src/features/settings/ProfileForm.tsx; reuse RelationshipSettings, safe gallery photo picker, existing logout and guided missing-photo states.
- [X] T071 [US6] Refresh home and authorship labels after profile/shared updates through src/features/settings/useSettings.tsx; ensure stale response cannot overwrite a newer version or revive deleted media.
- [X] T072 [US6] Run two-user profile/date/milestone/featured-photo settings journeys in tests/e2e/settings.spec.ts; record validation in specs/001-private-memory-website/validation/us6.md.

## Phase 9: User Story 7 - Partner In-App Notifications and Optional Email (Priority: P2)

**Goal**: Expose already durable partner-only events; email remains optional and disabled by default.
**Independent Test**: A changes data -> only B inbox item; reversed direction too. Disabled/unverified
sender and quotas never block saved content or in-app delivery. Retried workers avoid duplicate sends.
**Coverage**: FR-023..025; SC-008. Outbox schema/emission already required by T014 and all mutation tasks.

### Tests for User Story 7

- [X] T073 [P] [US7] Write recipient/read-state/lease tests in supabase/tests/notifications.test.sql for "Unique(event_id,recipient_id); recipient != actor; only other member at event commit", no old-event replay, direct actor inbox denial, recipient-scoped batch summary allow/deny cases (anon, outsider, wrong recipient, changed notification/batch IDs, cross-couple joins), field minimization and mark-read non-recursion; peer T074 after US6.
- [X] T074 [P] [US7] Write provider/worker contract tests in supabase/functions/tests/notifications.test.ts for disabled adapter zero network calls, forged worker auth, partner-only addresses, concurrent claims, 100/day budget, 30-minute provider dedupe and uncertain acceptance; peer T073 after US6.

### Implementation for User Story 7

- [X] T075 [US7] Finalize recipient-only inbox projection/read-state/retry routines in supabase/migrations/0016_notification_commands.sql and supabase/functions/api/notifications.ts; project upload summary only after notification.recipient_id matches authenticated current same-couple member and notification/event/batch couple IDs match; expose only batch reference, success_count, failure_count and open/closed/expired status, never raw file/storage/intent fields; actor cannot inspect partner inbox, current verified recipient rechecked, retries bounded and worker changes never emit events.
- [X] T076 [US7] Build inbox with unread/read persistence, generic actor/category/time/authenticated links, recipient-authorized batch counts/status from the safe inbox projection (no direct batch-table query), and disabled/pending/accepted/failed/quota status in src/features/notifications/InboxPage.tsx and src/features/notifications/useNotifications.ts; refresh navigation/focus and poll 60 seconds only while visible.
- [X] T077 [US7] Define replaceable provider interface and disabled adapter in supabase/functions/_shared/mail/provider.ts and supabase/functions/_shared/mail/disabled.ts; default flags fail closed, enabling email never replays historical disabled events, no browser key or arbitrary recipient input.
- [X] T078 [US7] Implement fixed Vietnamese generic Brevo transactional batch adapter in supabase/functions/_shared/mail/brevo.ts; server-only API key/sender, one partner recipient, headers.idempotencyKey stable UUID and 30-minute TTL, no private titles/text/photos and accepted != delivered.
- [X] T079 [US7] Add immediate/missed-signal recovery tests in supabase/functions/tests/dispatch.test.ts; content/inbox survive signal/provider failures, one-minute recovery shares claims/quotas, disabled mode sends nothing, five-minute target conditional on sender/provider/free allowance.
- [X] T080 [US7] Implement immediate post-commit signal helper in supabase/functions/_shared/dispatch.ts and leased worker in supabase/functions/notification-worker/index.ts; wire all existing mutation handlers to signal only after successful commit: dedicated server secret, <=20 rows/run, 100 daily attempts across mail categories, max five bounded-backoff attempts, persist provider result, quarantine unknown acceptance beyond dedupe window, no blind resend.
- [X] T081 [US7] Add server-only one-minute recovery schedule and metadata retention in supabase/migrations/0017_notification_maintenance.sql: 90-day events/notifications/deliveries/closed-batch metadata (retain ready photos), receipts through signed token expiry +24h, capacity alerts at 350 MB DB and nonessential growth stop at 400 MB while preserving cleanup/recovery.
- [X] T082 [US7] Document sender activation/manual invitation and recovery in docs/email-operations.md; verify Brevo account/From/domain eligibility and free allowance before enabling, never treat netlify.app as owned sender DNS, leave disabled without proof and never purchase an upgrade.
- [X] T083 [US7] Run recipient-only, read state, disabled-mode, provider outage/quota and duplicate-worker journeys in tests/e2e/notifications.spec.ts; record mocked outcomes separately from any operator-approved real sender test in specs/001-private-memory-website/validation/us7.md.

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final interface enhancements and complete release validation, without postponing basic
accessibility, Vietnamese feedback or privacy from the earlier functional story increments.

- [X] T084 Explain persistent relationship vs operational retention in src/features/settings/RetentionHelp.tsx; add supabase/tests/retention.test.sql proving 90-day event/inbox/delivery/closed-batch cleanup and receipt-expiry-plus-24h cleanup never delete relationship content or ready photos.
- [X] T085 Apply pastel-pink/cream/white tokens, spacing, soft shadows and reduced-motion-aware transitions in src/styles/tokens.css and src/app/AppShell.tsx; responsive navigation works at 320px with visible focus and no hover-only actions.
- [X] T086 Audit all routes for loading/empty/success/error/upload/quota states and keyboard/focus/contrast behavior in tests/e2e/accessibility.spec.ts; fix affected components only and record findings in specs/001-private-memory-website/validation/accessibility.md.
- [X] T087 Create bounded synthetic 1,000-memory/2,000-photo fixture and lazy-load/pagination performance checks in scripts/seed-performance.ts and tests/e2e/performance.spec.ts; measure 95% initial usable views <=3s at 10 Mbps/100ms without exceeding storage cap, record results in specs/001-private-memory-website/validation/performance.md.
- [X] T088 Add static Netlify configuration in netlify.toml for npm ci/build, dist, SPA fallback, HTTPS/security headers/CSP; restrict connections to selected Supabase origin, isolate preview environments and keep private data out of static output.
- [X] T089 Add production-bundle secret/private-fixture inspection in scripts/check-build-secrets.ts and package.json; verify browser exposure is limited to public Supabase configuration and no credentials, text or images leak through build/source maps/logs.
- [X] T090 Add encrypted manual DB/media export, <=30-day rotation and isolated restore procedure in docs/backup-restore.md and scripts/backup-manifest.ts; document free-tier pause/quota behavior and weekly usage review without assuming managed backups.
- [X] T091 Execute all commands/scenarios in specs/001-private-memory-website/quickstart.md after implementation; record actual pass/fail/blockers, SQL/Edge denial matrix, backup restore, sender-disabled gate and both-partner acceptance walkthrough in specs/001-private-memory-website/validation/release.md; no deployment or email activation is implied by this task.

## Dependencies & Execution Order

### Phase Dependencies

```text
Setup T001-T005
  -> Foundation T006-T019
  -> US1 T020-T030 (authentication + database security)
  -> US3 T031-T037 (relationship counter + initial home)
  -> US2 T038-T045 (text timeline)
  -> US4 T046-T060 (private uploads + timeline-photo integration)
  -> US5 T061-T066 (diary)
  -> US6 T067-T072 (remaining settings)
  -> US7 T073-T083 (inbox + optional email)
  -> Polish T084-T091
```

This is the requested default execution sequence, not a claim that every later story technically
depends on all earlier stories. Tests may use synthetic prerequisites; the following actual
integration dependencies must still hold:

- Every story needs Foundation and US1 access controls.
- US3 counter needs no US2/US4 data: placeholders provide a complete independent counter increment.
  Recent memories and featured photo are completed in T044/T059; full home acceptance waits for these.
- US2 text timeline is independently usable; its optional-photo acceptance completes at T059/T060.
- US4 needs US2 only for timeline integration T059; gallery security and tests can use fixture memories.
- US5 has no dependency on US4 uploads; use provisioned users and foundation event machinery.
- US6 reuses US3 date form and US4 validated images; no duplicate date/notification service.
- US7 tests its inbox with synthetic events independently of other content stories, but release
  validates every mutation category. Every earlier mutation must emit the transactional partner event
  using T014 even while the inbox UI and provider worker are not yet implemented.
- In a phase, proceed in ID order except the explicitly paired [P] tasks. Tests precede production
  implementation; shared files/migrations and integration tasks remain sequential.
- Any security, decoded-image resource-budget or identity-verification failure blocks affected
  functionality rather than weakening policies, enabling public buckets or auto-confirming strangers.

### Parallel Opportunities and Examples per Story

After the preceding default phase completes, these test-only pairs have separate files and can run
concurrently. Each pair must finish before the story's models/handlers are implemented.

| Story | Parallel example | Shared prerequisites |
| --- | --- | --- |
| US1 | T020 Edge enrollment contracts + T021 SQL/race tests | T001-T019 |
| US3 | T031 fixed-clock dates + T032 settings contracts | US1 |
| US2 | T038 memory contracts + T039 RLS/filter tests | US3 in default order |
| US4 | T046 image tests + T047 storage/race tests | US2 in default order |
| US5 | T061 entry contracts + T062 SQL/Unicode tests | US4 in default order |
| US6 | T067 settings contracts + T068 component tests | US5 in default order |
| US7 | T073 inbox SQL + T074 provider contracts | US6 in default order |

Setup T004/T005 and foundation T007/T008 are additional safe pairs after their stated prerequisites.
T049 creates reservation schema before T050 storage policies; T075 exposes the projection backed by T049, and T076 consumes it. No parallel task pair edits the same file. [P] is scheduling guidance, not a delegation instruction.

## Implementation Strategy

### MVP First

First checkpoint is Setup + Foundation + US1: a private two-account application with verified denial
paths, not the entire requested MVP. Next add US3 and text-only US2 for a useful romantic counter
and timeline. Add US4 to complete the photo-memory core. Do not describe partial milestones as full
MVP completion: diary, profiles, partner notifications and release validation remain required.

### Incremental Delivery

For each story, write the listed tests, observe meaningful failures, implement the constrained model
and trusted operations, connect a minimal accessible Vietnamese interface, then run its independent
acceptance check. Record failures/blockers honestly. Keep provider credentials server-side and
external email disabled throughout local development. Interface enhancements follow secure core
behavior; basic accessibility/error feedback is part of every story rather than deferred polish.

## Coverage and Completion Review

| Requirement group | Task coverage |
| --- | --- |
| FR-001..005 enrollment/auth/security | T010, T020-T030; direct-media security T047/T050 |
| FR-006 ownership | T023, T040-T042, T048-T054, T063-T064, T069, owner-denial tests |
| FR-007..010 home/counter/milestones | T031-T037, T044, T059 |
| FR-011..012 timeline | T038-T045, T059-T060 |
| FR-013..016 uploads/gallery | T046-T060 |
| FR-017 diary/letters | T061-T066 |
| FR-018 profiles/settings | T033-T035, T067-T072 |
| FR-019 validation/Unicode | T007-T009 and each story's quoted model constraints |
| FR-020..022 states/accessibility/privacy | T010/T018-T019, per-story UI/tests, T084-T091 |
| FR-023..025 partner notifications | T014-T015, every mutation routine, T073-T083 |
| FR-026 conflicts/idempotency | T013/T017-T018 and each versioned story command/test |

Tasks are descriptions of future work; no application code, hosted service change, deployment,
production email or application test execution is performed by generating this document.


### Approved remediation execution notes

Foundation identity precedes outbox dependencies; US1 extends tables. Clean replay runs without
fixtures. Every command validates signed operation and current authorization. Operation tests must
pass before user mutations complete. Exact requests reuse envelopes; changed subsets use new
operations with original batch/file IDs. One batch creates one notice; later successes update a
separate summary, no reset/resend. All mutation handlers signal dispatch only after commit once
worker/helper is available; until then durable pending/disabled rows remain recoverable. Retention
cleanup cannot delete saved relationship content. Keep release/deployment restrictions unchanged.


## Blocker-remediation checkpoint - 2026-11-08 (historical)

T001-T046 are now checked (46 completed, 45 remaining). Blocker remediation fixed milestone
no-op/replay behavior, operation denial/conflict error mapping and migration prerequisite assertions;
added real HTTP security/concurrent replay/expired-after-purge tests and browser image preparation.
The actual worker gate passed: a 24 MP source was prepared to 1600 x 1066 and validated in 77 ms;
direct raw-source bypass returned 422 before decoding. See validation/image-resource-gate.md.
Source selection remains <=24 MP/10 MiB; only a compressed copy is stored, as synchronized in
spec/plan/contracts/data-model. No upload publication route, buckets, hosted service or deployment
was enabled. T047-T091 remain unchecked; this remediation does not resume those tasks.

Completed-story verification is recorded in validation/foundation.md, validation/us1.md,
validation/us3.md and validation/us2.md. Other MVP stories and final release validation are pending.

### Prior Storage checkpoint - blocked, 2026-11-08 (superseded below)

Started T047-T050: added media/reservation/bucket migrations and Storage/SQL security tests.
No additional task is checked. Two new integration tests failed before the migration replay file
ran; the suite was interrupted per the requested failure gate. Local inspection afterward shows
migrations 0001-0011 exist, but this is not evidence that Storage authorization passed.
Fix integration setup ordering and rerun clean replay, Storage tests and SQL assertions before
continuing. See validation/us4.md for actual results and the local-only diagnostic sequence.
At that checkpoint, T001-T046 were complete and T047-T091 incomplete.

### Current Storage verification checkpoint - PASS, 2026-11-08

T047-T050 now passed and are checked: T001-T050 complete (50 completed, 41 remaining).
Explicit global setup creates/guards the isolated lover-integration project on 55321/55322,
replays 0001-0011 and runs SQL assertions before test collection. Single-worker execution and
a suite lock protect setup. The development database and hosted/linked projects are not reset.

Actual results: 71 SQL assertions; 7 full integration tests; final repeated Storage/prerequisite
subset 5 tests; 23 unit and 22 Edge tests; lint, typecheck and build all passed. An initial lint
cleanup error was corrected and lint rerun successfully. See validation/us4.md for commands,
limits, modified files and reports. Exact reserve retries replay one result; conflicting duplicates
and expired operations fail. Partial staging retries preserve completed bytes. Publication,
finalization and batch-notification behavior remain T052+ and are not claimed complete.

Stop here for this verification request. Resume at T051 only in subsequent implementation work.


### T051-T053 upload-finalizer checkpoint - BLOCKED, 2026-11-08

Drafted signed upload handlers/schemas and trusted lease/publication/receipt/close routines, plus
partial-finalization, concurrency, scope, invalid-byte, expiry and actual-worker resource tests.
No additional task is checked. Edge tests: 24 passed; disposable migration replay + 71 SQL assertions
passed; integration: 8 passed / 1 failed. The required 24 MP case failed in its browser harness with
ReferenceError: __vite_ssr_dynamic_import__ is not defined before invoking the finalizer. Stop gate
applied; no later tasks or checks run. See validation/us4.md and preserved artifacts/t051-upload-gate-*
for the complete failure. Fix the test-only module loading and rerun before marking T051-T053 complete.
T001-T050 remain completed; T051-T091 remain unchecked (50 completed, 41 remaining).

### T051 browser harness resolution - PASS, 2026-11-09

T051 is now checked. The browser uses a dedicated test HTML page and Vite client ESM on a
temporary loopback port, loading the real image-preparation module without Vitest SSR callbacks
performing imports. A 6000 x 4000 JPEG became 1600 x 1066, then the actual Edge finalizer saved
a 10527-byte private JPEG from 10811 prepared bytes. Partner download, outsider/signed-link denial,
idempotency and partial retries passed. No WORKER_LIMIT occurred in the executed gate.

Actual results: full integration 11 passed; SQL assertions 71 passed; unit 23 passed; Edge 24 passed;
lint, typecheck and build passed (existing bundle-size warning). Initial startup failed because
Docker was stopped; it was started and the full sequence rerun successfully. Preserved artifacts
and exact cause/results are recorded in validation/us4.md. No development or hosted DB was reset.

Stop at this requested verification boundary: T001-T051 complete (51 completed, 40 remaining).
T052-T091 remain unchecked, including acceptance of the existing finalizer draft beyond T051.
Ready to resume at T052 in a subsequent implementation request.


### Current implementation checkpoint - BLOCKED, 2026-11-10

T052-T055 completed with recorded gates: signed finalization/partial retries, metadata ownership and
reference cleanup, bounded worker/schedule/quota recovery. T001-T055 checked (55 completed).
T056-T060 upload/gallery/memory UI and isolated browser setup are drafted but NOT accepted.
Typecheck, lint, 29 unit tests and build passed before the gallery acceptance attempt.

Required npm.cmd run test:e2e -- tests/e2e/gallery.spec.ts failed during its SQL prerequisite:
media-commands.test.sql:46 has malformed single-dollar throws_ok quoting. PostgreSQL returned exit 3;
23 subtests in that file passed before the syntax error, and the overall SQL gate failed with no final
TAP plan. Browser cases did not start. Execution stopped immediately at this gate; no Diary/settings/
notification/release work began. See validation/us4.md and artifacts/t056-t060-failed-* for full evidence.

T056-T091 remain unchecked (36 remaining). Repair the SQL fixture delimiter and rerun acceptance
before marking the drafted UI tasks complete. The source fix was intentionally not applied after
failure because the user explicitly required a stop on any required test failure.

SQL delimiter remediation (2026-11-10): clean disposable replay and 95 SQL assertions passed. Gallery acceptance failed (desktop album selector timeout; mobile count 4 versus 2). T056-T060 remain unchecked; subsequent checks stopped. See validation/us4.md and artifacts/t056-sql-fix-* for reproduction evidence.

Gallery remediation (2026-11-10): original photo album selector passes; failure-safe disposable cleanup verified (0 photos/batches/couples/Storage objects). 95 SQL assertions pass. Desktop now blocks at gallery.spec.ts:144 filter exact-label locator; mobile skipped by maxFailures=1. Validation stopped; T056-T060 remain unchecked. See validation/us4.md and artifacts/t056-selector-isolation-*.

Filter accessibility remediation (2026-11-10): explicit filter label and role locators added; Vietnamese Gallery nav repaired. Clean replay/95 SQL assertions pass. Desktop fails earlier on partner login Email locator (gallery.spec.ts:16, call at 117); mobile skipped. Cleanup counts all zero. T056-T060 remain unchecked; no repeat/later checks run. See validation/us4.md and artifacts/t056-filter-accessibility-*.

Final Gallery acceptance (2026-11-10): logout/navigation race resolved; desktop/mobile passed twice, clean replay/95 SQL assertions passed, integration 16, unit 29, Edge 29, lint/typecheck/build passed. Final disposable fixture counts 0 photos/batches/couples/Storage objects. T056-T060 checked; T001-T060 complete (60), T061-T091 remain (31). Resume T061. See validation/us4.md for commands and evidence.

US5 complete (2026-11-10): T061-T066 passed. Clean disposable replay 0001-0014 and 125 SQL assertions; integration 17, unit 35, Edge 32; desktop/mobile Diary + Gallery 4 browser passes; lint/typecheck/build passed. Resolved new unit fixture cleanup failure; no unresolved blockers. Final disposable entry/photo/batch/couple/object counts zero. T001-T066 complete (66), T067-T091 remain (25). Resume profiles/settings T067. Evidence: validation/us5.md. Development database unchanged; preview needs operator-applied migration 0014 without reset.

US6 complete (2026-11-10): T067-T072 verified. Clean disposable replay 0001-0015 and 147 SQL assertions pass; full integration 18, unit 42, Edge 35; desktop/mobile Settings + Gallery + Diary 6 passes and final Settings rerun 2 passes; lint/typecheck/build pass. Initial Docker engine outage resolved before testing. Final disposable entry/photo/batch/couple/object counts zero. T001-T072 complete (72), T073-T091 remain (19). Next: partner inbox/optional email T073. Evidence: validation/us6.md. Development/production data unchanged; preview needs pending migrations through 0015 without reset.

Final MVP checkpoint — PASS, 2026-11-10: T073–T091 accepted; T001–T091 complete (91),
no remaining task IDs. Implemented recipient-only inbox/preferences, optional disabled-by-default
email adapters, post-commit wake-up/recovery, bounded leases/dedupe/quotas, permanent-content-safe
operational cleanup, responsive accessibility, production hosting guards and encrypted backup tools.
Actual gates: clean disposable replay 0001–0017; 189 SQL assertions, 21 integration, 46 unit,
42 Edge, 23 ordinary browser passes plus 1 pre-existing mobile enrollment skip, and 2 separately
executed production-CSP performance cases. Desktop/mobile p95 1043.07/1037.68 ms. Fresh npm ci,
lint/typecheck/build/bundle inspection passed. Existing Vite chunk-size warning remains.
Final fixture counts entries/photos/batches/couples/Storage objects all zero. No unresolved mandatory
failures; intermediate issues and actual corrections recorded in validation/us7.md, accessibility.md,
performance.md and release.md. External sender approval, operator production recovery and any
hosted deployment remain manual/unperformed. No real mail or production/development data changes.
