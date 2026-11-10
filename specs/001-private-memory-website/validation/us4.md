# US4 Gallery acceptance: PASS - 2026-11-10

Current checkpoint: T001-T060 complete; resume at T061. The final acceptance record below
supersedes historical blocked checkpoints, retained as reproduction evidence.
Desktop/mobile Gallery passed twice; integration 16, SQL 95, unit 29 and Edge 29 passed.
Lint/typecheck/build passed. No development or production database was changed.

## Historical Storage integration gate: PASS - 2026-11-08

Ready to resume at T051. T047-T050 passed their schema/reservation/Storage validation.
No production resources or the development database were reset or modified. No upload finalizer
or gallery UI has been implemented by this testing-infrastructure change.

## Root cause

Clean migration replay was an ordinary test file. Disabling file parallelism serialized files but
did not make that file a prerequisite. Storage tests could run first against the old schema; replay
could then change the schema after those failures. The previous run was interrupted before detailed
assertions were printed, so its exact database error cannot be reconstructed. No historical error
message is inferred or presented as captured evidence. With explicit setup, the existing migration
and Storage-policy SQL passes; no policy or schema changes were needed for this gate.

## Deterministic, disposable setup

Vitest globalSetup now runs before test collection. It creates a marked .test-stack workspace,
uses project lover-integration with API/database ports 55321/55322 and container
supabase_db_lover-integration, verifies exact loopback targets, starts services, replays all migrations
with explicit --local --no-seed, and runs all SQL assertions before tests. It then waits for Auth,
Data API schema and Edge readiness. The API server uses separate generated test-only signing keys.
Neither linked project settings nor the development project lover/ports 54321-54322 are reset.

Migration 0010 creates upload_batches/upload_files/upload_reservations and helpers before 0011
creates dependent Storage policies. PostgreSQL resolves those dependencies during clean replay;
the migration test checks that the tables and both policies exist after setup. It no longer resets
anything as a side effect. Existing enrollment reset and cleanup helpers target only the isolated
project when run by this integration configuration.

Single-worker configuration plus an exclusive runner lock prevents concurrent suites from bypassing
setup or resetting each other's fixtures. A second run starts from a clean schema. Development/remote
URLs and unmarked directories are refused. Generated workspace/configuration is ignored by Git,
Docker and ESLint. Bootstrap credential output is withheld/redacted.

## Commands executed and actual results

1. npm run test:integration -- tests/integration/storage.test.ts tests/integration/migrations.test.ts
   - Global clean migration replay: passed (0001 through 0011).
   - SQL schema/authorization gate: 71 assertions passed across six SQL files.
   - Initial two Storage checks + migration prerequisite check: 3 passed.
   - Expanded expiry/replay/partial-staging/quota checks + prerequisite check: 5 passed.
   - Final repeat after the cleanup lint correction: clean replay + 71 SQL assertions + 5 tests passed again.
2. npm run test:integration
   - Repeated clean replay and all 71 SQL assertions passed before tests.
   - All 7 integration tests passed across four files, including enrollment races and real Edge API security.
3. npm run test -- --run: 23 tests passed across nine files.
4. npm run test:edge: 22 tests passed.
5. npm run lint initially reported no-unsafe-finally at storage.test.ts lines 145 and 312.
   Redundant inline throws were removed; the shared cleanup helper retains UUID/target checks.
   npm run lint then passed.
6. npm run typecheck: passed.
7. npm run build: passed; nonblocking warning remains for the 658.33 kB JavaScript chunk.

Verbose test output and full assertion failures are persisted by the JSON reporter at
artifacts/integration-results.json. Redacted CLI replay/SQL/service logs are stored at
artifacts/integration-bootstrap.log. Reports describe the latest run; credential values are not
part of the report. The earlier interrupted run's assertions were never captured.

## Behaviors verified

- Reservation owner can insert only the exact allocated private staging path; partner/outsider and
  forged paths fail. Staging reads, signing and overwrite attempts fail.
- Media cannot be downloaded without ready metadata. Ready same-couple media is downloadable;
  outsider/public/signed-link access fails. Deleting metadata immediately blocks further downloads.
- Composite scope and own-avatar FKs, raw upload-table grants and generic mutation denial pass SQL checks.
- Three concurrent 400 MiB reservations permit exactly two and reject the third at the 800 MiB cap.
- An exact reserve retry returns the original IDs/result and one receipt without reserving more bytes.
  Conflicting duplicate hashes and expired operation requests are rejected, including expiry before
  an existing receipt can be reused. Exact retries are intentionally idempotent, not new operations.
- A failed second staging upload can be retried without overwriting the completed first file; stored
  first-file bytes remain identical. An expired reservation cannot accept a remaining file.

These are staging/reservation checks, not completed photo publication. Server finalization, compensating
cleanup, immutable successful publication, and one-notification-per-batch validation remain T052-T055.
Browser 24 MP preparation and the actual image worker gate were not rerun in this turn; their previous
passing evidence remains in image-resource-gate.md. No real sender, email activation or deployment occurred.

## Files modified in this verification

- .gitignore
- .dockerignore
- eslint.config.js
- vitest.integration.config.ts
- tests/helpers/disposableStack.ts (new)
- tests/helpers/localStack.ts
- tests/integration/global-setup.ts (new)
- tests/integration/migrations.test.ts
- tests/integration/enrollment-race.test.ts
- tests/integration/api-security.test.ts
- tests/integration/storage.test.ts
- tests/unit/disposable-target.test.ts (new)
- README.md
- specs/001-private-memory-website/tasks.md
- specs/001-private-memory-website/validation/us4.md

The existing 0009-0011 SQL migrations were reviewed and tested, not modified in this verification.


## T051-T053 resumption - BLOCKED, 2026-11-08

The prior Storage gate remains passing. No task beyond T050 is marked complete.
Draft finalization work adds signed upload command schemas/routes, per-file leases and atomic
publication/accounting routines in 0010_upload_reservations.sql. One file is finalized per command
(maximum 20 files still allowed per batch) to bound CPU. It validates actual staged bytes, generates
server JPEG output, denies foreign intents, preserves ready-file results, emits the batch event only
at first success and updates separate counts thereafter. A quarantined lease protects compensating
cleanup against late publication. Closed/failed unused reservations remain charged pending T055 cleanup.
These drafts are not acceptance-complete until the mandatory image/finalization gate passes.

Executed:

- npm run test:edge: 24 passed, 0 failed (includes two new upload-schema tests).
- npm run test:integration -- tests/integration/upload-retries.test.ts tests/integration/storage.test.ts tests/integration/migrations.test.ts
  - Disposable clean migration replay: succeeded.
  - SQL assertions: 71 passed across six files.
  - Integration: 8 passed, 1 failed; exit 1. Complete suite finished so failure assertions were retained.
  - Passing new cases: partial finalize/failed-only retry + stable read state/one batch event;
    concurrent exact finalize + response-loss replay/actor/identifier denial; invalid bytes + close/expiry.
  - Existing four Storage cases and migration prerequisite case passed.
  - The 24 MP browser-to-finalizer test failed before reaching finalization. This is not a new
    WORKER_LIMIT result and does not establish resource compliance of the integrated finalizer.
- Unit tests, lint, typecheck, production build and subsequent feature work were not run after failure.

Exact failure:

~~~text
FAIL tests/integration/upload-retries.test.ts
24MP source is browser-prepared then validated and published in the actual limited Edge worker
Error: page.evaluate: ReferenceError: __vite_ssr_dynamic_import__ is not defined
    at eval (eval at evaluate (:370:30), <anonymous>:2:29)
    at UtilityScript.evaluate (<anonymous>:372:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
tests/integration/upload-retries.test.ts:377:27
  prepared = await page.evaluate(async ({ moduleUrl, source }) => {
    const { prepareImage } = await import(moduleUrl);
~~~

Cause: Vitest/Vite transforms the callback's dynamic import for its SSR runner before Playwright
serializes the callback into Chromium. The resulting callback refers to a runner helper unavailable
in the browser. The generated production-module data URLs are not themselves a server finalization
failure. Next work must load the test module through a browser-executed module script or equivalent
untransformed browser source, then rerun this same disposable gate before dependent tasks.
The harness fix was not applied after failure because the user explicitly required stopping.

Preserved full evidence (ignored local artifacts): artifacts/t051-upload-gate-results.json and
artifacts/t051-upload-gate-bootstrap.log. Default integration reports remain available too.
No development database, hosted resources, credentials, email settings or deployments were changed.
No extension hooks are configured. T051-T091 remain incomplete (50 completed, 41 remaining).


## T051 browser harness resolution - PASS, 2026-11-09

This supersedes the 2026-11-08 browser-harness failure above. T051 passed and is checked;
T052-T091 remain unchecked. Stop here: ready for a subsequent implementation request at T052.

### Exact cause and fix

The failing expression was await import(moduleUrl) inside the function passed to page.evaluate
in upload-retries.test.ts. Vitest's SSR transformation rewrote it to a call to
__vite_ssr_dynamic_import__. Playwright serialized that transformed function into Chromium, where
that Node-runner helper does not exist. The failure occurred before image preparation/finalization.

Removed the handcrafted transpile/data-URL module helper. tests/helpers/browserImage.ts now starts
an independent Vite client server bound to 127.0.0.1 on an ephemeral port. It disables project config,
env-file loading, public assets, HMR and watching. tests/browser/image-preparation.html statically
imports the actual /src/lib/prepareImage.ts module and exposes its real function to the test page.
Chromium fetches that ESM module with HTTP 200. page.evaluate only passes source data to the loaded
function and reads its result; no imports or SSR module code cross that serialization boundary.
The browser and temporary Vite server close in finally. No mocks or processing shortcuts were added.

The test independently decodes the prepared File in Chromium to assert its real dimensions. It
then stages those exact bytes, calls the actual authenticated Edge finalizer and verifies saved
metadata, partner byte download, outsider denial and signed-link denial. The production image
module, finalizer and Storage policies were not changed by this fix.

### Startup failure and recovery

The first npm.cmd run test:integration attempt exited 1 in global setup before collecting tests.
Read-only docker info diagnosed the missing dockerDesktopLinuxEngine named pipe, and Docker
Desktop/backend processes were not running. Docker Desktop was started hidden; docker info then
returned version 28.5.1. This was a local prerequisite failure, not a test/WORKER_LIMIT result.
The complete requested sequence was rerun after restoring that dependency.
Startup evidence is retained in artifacts/t051-2026-11-09-startup-failure.log and
artifacts/t051-2026-11-09-startup-results.json. The exact Docker error was:

~~~text
error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/info":
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
~~~

### Executed commands and results

| Command | Actual result |
| --- | --- |
| npm.cmd run test:integration | 11 passed across 5 files; exit 0 |
| Global setup: clean local migration replay | Passed, 0001 through 0011, lover-integration only |
| Global setup: SQL schema/authorization assertions | 71 passed across 6 files |
| npm.cmd run test -- --run | 23 passed across 9 files; exit 0 |
| npm.cmd run test:edge | 24 passed; exit 0 |
| npm.cmd run lint | Passed; exit 0 |
| npm.cmd run typecheck | Passed; exit 0 |
| npm.cmd run build | Passed; exit 0; existing 658.33 kB JavaScript chunk warning |

Measured actual-worker gate console record:

~~~json
{"gate":"actual-edge-finalization","sourcePixels":24000000,"preparedBytes":10811,"storedBytes":10527,"requestWallMs":180}
~~~

Chromium accepted the synthetic 6000 x 4000 JPEG and prepared a real 1600 x 1066 JPEG (longest edge
1600). The actual Edge finalization returned HTTP 200 and ready photo metadata; no WORKER_LIMIT
occurred. The stored JPEG was downloadable by the partner and denied to the outsider; the partner
could not mint a signed bearer URL. The 180 ms value is the measured test segment's wall time,
including issue/finalization and Storage checks, not a CPU measurement or performance guarantee.
Existing integration cases also passed exact/concurrent replay, changed identifiers/actor denial,
partial failed-file retries, immutable ready-file results, close/expiry, one batch event/notice,
preserved read state and quota races.

Full passing evidence is preserved at artifacts/t051-2026-11-09-passed-results.json and
artifacts/t051-2026-11-09-passed-bootstrap.log. The original failed November 8 reports remain intact.

### Files modified in this fix

- tests/helpers/browserImage.ts
- tests/browser/image-preparation.html (new)
- tests/integration/upload-retries.test.ts
- specs/001-private-memory-website/tasks.md
- specs/001-private-memory-website/validation/us4.md
- README.md

Only the marked disposable lover-integration database was reset. No development database reset,
production service change, deployment, email delivery or credential change was performed. T052+
acceptance and remaining MVP work have not been advanced by this focused fix.


## T052-T053 acceptance - PASS, 2026-11-09

Reviewed existing signed upload handlers and added real orphan-compensation/quarantine tests.
Executed npm.cmd run test:integration -- tests/integration/upload-retries.test.ts: 71 SQL assertions
and 6 integration cases passed, including the 24 MP browser-to-worker path (181 ms measured segment),
partial retry, immutable exact receipts, one batch event/read state, close/expiry, actor/ID denial,
unpublished orphan removal and rejection of a late commit after lease revocation. No code was
rewritten for these already-implemented handlers. Preserved artifacts/t052-t053-passed-results.json.
T052 and T053 are checked. T054 onward remain dependent work; in-app projection assertions stay US7.


## T054 metadata commands - PASS, 2026-11-09

Added media schemas and 0012_media_commands.sql, delegating existing relationship/memory commands
to their verified routine. Author/creator writes, Unicode metadata, unchanged-save suppression,
version conflicts, partner-album assignment, album detach/preservation and photo tombstone reference
cleanup are covered. Executed Edge tests (26 passed) and full disposable integration (13 passed),
including clean replay and 89 SQL assertions. No source rewrite of completed relationship logic.


## T055 bounded maintenance - PASS, 2026-11-10

Implemented one-minute credential-gated scheduling, an exclusive server worker lease and at most
20 jobs per call for expired/orphaned uploads, residual staging, deleting photos and object checks.
Reservations remain charged until confirmed cleanup; ready photos with missing objects retain
metadata and budget for recovery. Worker operations emit no new relationship events. Added
private queue grants so scheduled headers are not browser-readable. No Vault dispatch values
were created; the schedule is network-inactive until an operator configures it.
Executed Edge tests (29 passed) and full disposable integration (16 passed), including clean replay,
89 SQL assertions, worker authentication/concurrent lease, expired-orphan quota release, idempotent
delete and preservation of ready metadata for missing objects. Migrations 0001-0013 replayed.


## T056-T060 UI checkpoint - BLOCKED, 2026-11-10

T052-T055 are checked based on their earlier successful acceptance gates. T056-T060 are drafts
and remain unchecked; subsequent MVP features were not started.

Implemented drafts:
- Sequential browser preparation and direct reservation-scoped XHR upload progress, failed-only retry,
  stable prepared File/server IDs/envelopes, per-file states, explicit close and logout cancellation.
- Private authenticated image downloads with a 32 MiB active-blob cap, per-consumer object URLs,
  close/logout revocation and rejection of late downloads after session cleanup.
- Gallery pagination/album filter/create/rename/delete, uploader-only metadata forms/deletion,
  keyboard full-screen viewer, memory attachment selection/display and featured-photo display.
- Transactional memory association wrapper delegates verified text writes; photo-only changes version
  and notify once, invalid/deleting references are rejected and exact receipts remain immutable.
- Playwright now uses the same marked disposable backend, a dedicated Vite server on 5175 and only
  public test configuration. The development server/database is not reused. Gallery acceptance
  covers actual preparation, an injected network failure (not image mocking), retry, album/viewer,
  partner controls and reference cleanup once its SQL setup gate passes.

Successful checks before the blocker:
- npm.cmd run test -- --run: 29 passed, including new upload coordinator and private-image tests.
- npm.cmd run typecheck: passed.
- npm.cmd run lint: passed.
- npm.cmd run build: passed; 681.62 kB JavaScript chunk warning remains nonblocking.
- The prior T055 full integration gate passed 16 integration tests / 89 SQL assertions and 29 Edge
  tests; that gate preceded the new memory attachment cases below and is not a claim this gate passes.

Failing command:

~~~text
npm.cmd run test:e2e -- tests/e2e/gallery.spec.ts
~~~

Clean disposable migration replay succeeded, then SQL setup failed before browser test collection.
No desktop/mobile gallery browser scenario ran. media-commands.test.sql emitted 23 passing subtests
before PostgreSQL stopped at line 46. Overall SQL runner output:

~~~text
/Code/lover/.test-stack/supabase/tests/media-commands.test.sql
Dubious, test returned 3 (wstat 768, 0x300)
All 23 subtests passed
Non-zero exit status: 3
Parse errors: No plan found in TAP output
Files=7, Tests=94
Result: FAIL
psql:/Code/lover/.test-stack/supabase/tests/media-commands.test.sql:46:
ERROR: syntax error at or near "$"
LINE 1: select throws_ok($select pg_temp.mutate(...)
~~~

The file contains single-dollar delimiters around the final throws_ok query, rather than valid
PostgreSQL double-dollar quoting. Root cause: the edit inserted SQL using JavaScript String.replace
with a replacement string containing double-dollar delimiters; replacement-string semantics collapse
$$ to a literal $. The PowerShell literal here-string was not the cause. This is an introduced SQL
regression-fixture syntax error, not evidence of a Storage or browser application failure.
It prevents finish() from emitting the TAP plan, causing the secondary "No plan found" diagnostic.

Next step (not applied because the user required stopping): restore valid dollar quoting in
supabase/tests/media-commands.test.sql:46; use a replacement callback when generating SQL text so
replacement tokens are not interpreted. Rerun the disposable SQL prerequisite, then the complete
browser gallery gate before checking T056-T060. The first five new attachment assertions ran, but
the failed file is not accepted as a passing SQL suite.

Complete reproduction evidence is retained at artifacts/t056-t060-failed-bootstrap.log and, if
emitted by Playwright, artifacts/t056-t060-failed-browser-results.json. No extra tests were run after
failure. No production services, sender configuration, credentials or development DB were changed.
The .specify/extensions.yml file is absent; no post-implementation hooks are configured.

## SQL delimiter remediation - prerequisite PASS; Gallery BLOCKED (2026-11-10)

Restored both PostgreSQL $$ delimiters in media-commands.test.sql:46. The command,
JSON payload, expected SQLSTATE/message and assertion label are unchanged. Reviewed every
other dollar-containing block in the complete fixture: existing pairs remain intact. Used
literal .NET String.Replace, not JavaScript replacement-string interpolation; no generator
was added or altered. No SQL or authorization checks were bypassed.

Executed: npm.cmd run test:e2e -- tests/e2e/gallery.spec.ts
The first sandbox attempt failed accessing the Supabase CLI telemetry cache (EPERM).
Retried with approved elevation. The guarded lover-integration environment replayed all
migrations successfully and ran all 7 SQL files: 95 assertions PASS, including 24 in
media-commands.test.sql. Development and production databases were not targeted.

Browser result: 2 failed (Chromium and mobile), process exit 1.
Chromium: Test timeout of 120000ms exceeded at gallery.spec.ts:68:61:
locator.selectOption waiting for getByLabel('Album c?a ?nh', { exact: true }).
The snapshot contains the edit form and album option; the exact locator/accessibility cause
has not been established. Do not attribute this to SQL, Storage or authorization.
Mobile: gallery.spec.ts:54:45 expected getByRole('article') count 2, received 4 (5000ms).
The desktop case had already uploaded two photos and aborted before cleanup; both projects
reuse provisionCoupleLocal identities and database, so failure residue is a fixture-isolation
concern. The runner automatically started mobile before interruption; it also failed.

Stopped further validation on this mandatory failure. No subsequent Storage/upload integration,
unit, Edge, lint, typecheck or build commands were executed in this remediation run. Previously
recorded passes remain historical evidence only. T056-T060 remain unchecked; T001-T055 remain
complete. No source fix for the newly exposed browser failures was attempted after the stop.

Preserved evidence:
- artifacts/t056-sql-fix-bootstrap.log (redacted clean replay and SQL output)
- artifacts/t056-sql-fix-browser-results.json (exact browser assertions and stacks)
- test-results/gallery-private-gallery-su-b66da-nd-memory-reference-cleanup-chromium/trace.zip
- test-results/gallery-private-gallery-su-b66da-nd-memory-reference-cleanup-mobile/trace.zip
- corresponding error-context.md snapshots next to each trace.

Next gate: investigate desktop selectOption timeout and isolate browser fixtures between
projects/failures, then rerun Gallery acceptance before continuing the requested checks.

## Gallery selector and failure cleanup remediation - BLOCKED (2026-11-10)

Inspected the original trace events, final screencast JPEG (preserved at
artifacts/gallery-selector-before.jpeg), and DOM snapshot. The photo album select was
visible, enabled and populated. Its implicit wrapping label included select option text,
so the exact getByLabel label-text lookup did not match. The accessible role snapshot did
show the intended combobox name. PhotoDetailsForm now uses a separate explicit htmlFor/id
label via useId; the test uses getByRole('combobox') with visible/enabled/option assertions.
The original selection step now succeeds without force actions or increased timeouts.

The previous mobile count failure was shared fixture residue: beforeAll reused fixed auth
accounts and the singleton couple; record/object cleanup depended on reaching the successful
end of the desktop journey. Added tests/helpers/galleryFixture.ts and beforeEach/afterEach
hooks: exclusively guard the marked lover-integration directory, loopback ports and container;
remove media/staging objects with the server-only Storage API; transactionally clear disposable
relationship fixture rows and operational quota; assert no objects/photos/batches/couple remain.
Existing auth identities may be reused, but no mutable relationship fixture is shared between
cases. Page closes before teardown to stop requests. Runner retains one worker and now has
maxFailures=1 so a required failure skips subsequent projects. No development DB reset or
production change was performed.

Executed npm.cmd run test:e2e -- tests/e2e/gallery.spec.ts with local Docker/Chromium permission.
- Clean replay of migrations 0001-0013: PASS.
- SQL: all 7 files and 95 assertions PASS.
- Browser: 1 FAILED (desktop), 1 DID NOT RUN (mobile), exit 1.
- Desktop progressed past original album selection, partial retry, viewer, memory association,
  partner controls, deletion and second photo album assignment, but timed out at a later lookup:
  tests/e2e/gallery.spec.ts:144:57 getByLabel('L?c album', { exact: true }).selectOption.
  Test timeout 120000ms exceeded. Target page/context closed by afterEach when it timed out.
  GalleryPage still uses a wrapping label around the filter select, the same label-text hazard.
- afterEach cleanup ran on failure. A guarded read-only query after runner exit returned
  photos=0, upload_batches=0, couples=0, storage.objects=0 (raw psql: 0|0|0|0).
  The first diagnostic query had a JavaScript quoting syntax error before execution; the
  corrected read-only query produced these counts. No database mutations in diagnostics.

Stopped immediately at this mandatory failure. No second Gallery run, upload/Storage integration,
unit/Edge, lint/typecheck/build were executed in this attempt; repeatability and mobile remain
unverified. No T056-T060 task marked complete. Next blocker: explicitly associate the filter
label/control or use its accessible combobox role, then rerun all requested gates, including
Gallery twice. No fix was applied after the failed mandatory gate.

Evidence: artifacts/t056-selector-isolation-bootstrap.log,
artifacts/t056-selector-isolation-browser-results.json,
artifacts/t056-selector-isolation-trace.zip and the desktop error-context.md in test-results.
Modified implementation/test files in this attempt: src/features/gallery/PhotoDetailsForm.tsx,
tests/e2e/gallery.spec.ts, tests/helpers/galleryFixture.ts, playwright.config.ts.

## Gallery filter accessibility remediation - BLOCKED (2026-11-10)

Inspected prior trace frame snapshots and API events. The filter SELECT was rendered,
populated and enabled, inside LABEL text 'L?c album' plus nested OPTION text. Playwright's
exact getByLabel text matching includes this descendant option text, so it did not find an
exact match. This is not an album-loading or hidden/disabled-control issue. Separated LABEL
and SELECT with a React useId-generated id and htmlFor. The role-based combobox locator now
also checks visible/enabled state, accessible name, exact label association and expected option.
Reviewed Gallery E2E controls: both album selectors now use role locators; text/date inputs,
file input, checkbox labels and named dialog buttons do not contain nested option text.
Reused the role locator for the second photo edit. Fixed confirmed corrupted Vietnamese
Gallery navigation text ('Th? vi?n ?nh' to 'Thu vi?n ?nh'). No steps/assertions removed,
force actions added or timeouts increased. Failure-safe cleanup and first-failure gate retained.

Modified application/test files: src/features/gallery/GalleryPage.tsx, src/app/router.tsx,
tests/e2e/gallery.spec.ts. Also updated this evidence and tasks.md checkpoint.

Executed npm.cmd run test:e2e -- tests/e2e/gallery.spec.ts against guarded lover-integration.
- Clean migration replay: PASS.
- All 7 SQL files / 95 assertions: PASS.
- Browser: desktop FAILED, mobile DID NOT RUN (maxFailures=1), exit 1.
- Failure: test timeout 120000ms exceeded; locator.fill waiting for
  getByLabel('Email', { exact: true }); target page/context closed by teardown.
  Stack: login at gallery.spec.ts:16:51, called at gallery.spec.ts:117:5 (partner login).
  The journey had passed initial login, uploads/retry, photo metadata, viewer and memory
  association. It did NOT reach the filter step in this run, so filter acceptance is unverified.
- Logout handler fires asynchronous signOut; test immediately navigates in login() without
  waiting for the unauthenticated UI. This is a potential logout/navigation race to investigate;
  do not claim a confirmed underlying Auth failure from this timeout alone.
- Read-only guarded post-failure counts returned 0|0|0|0: photos, upload_batches, couples,
  storage.objects. Teardown succeeded even on failure.

Stopped at required failure. No repeat Gallery suite or subsequent upload/Storage integration,
unit, Edge, lint, typecheck or production build was run. Historical passes do not validate
these latest edits. No task newly checked: T001-T055 complete, T056-T091 unchecked.
No development database reset, production/external resource change or deployment occurred.

Preserved artifacts: t056-filter-accessibility-bootstrap.log,
t056-filter-accessibility-browser-results.json and t056-filter-accessibility-trace.zip
under artifacts/. Next gate requires investigating partner login after logout, then rerunning
Gallery desktop/mobile twice before continuing the remaining required checks.

## T056-T060 final Gallery acceptance - PASS (2026-11-10, Asia/Saigon)

Confirmed Auth root cause from the preserved failing trace: POST /auth/v1/logout?scope=global
ended with net::ERR_ABORTED when login() immediately navigated to /gallery. The last screenshot
(artifacts/gallery-auth-before.jpeg) still showed the authenticated Gallery/header. The Email
input was correctly absent because logout had not completed, not because of a label mismatch.
Inspected console events and DOM/navigation snapshots; no Email rendering exception was reported.

Application fix: Router awaits signOut with a pending state that removes private views, and
shows a safe retry state if logout fails. Existing Supabase session events and membership guards
remain in place. Same-browser switching is supported. E2E waits for the real successful logout
response and visible Email input before navigating, asserts private navigation is absent and
verifies /gallery and /timeline still render login with zero private articles. No timeout increase,
arbitrary sleep, forced action, Auth mock, assertion bypass or authorization change introduced.
Prior explicit album/filter label fixes now pass the complete browser journey.

Commands executed successfully in dependency order:
1. npm.cmd run test:e2e -- tests/e2e/gallery.spec.ts
   Clean replay 0001-0013 and 95 SQL assertions PASS; 2 browser tests PASS:
   Chromium 18.9s, mobile Chromium 17.9s. Total 1.1m.
2. npm.cmd run test:e2e -- tests/e2e/gallery.spec.ts (identical repeat)
   Clean replay and 95 SQL assertions PASS; 2 browser tests PASS:
   Chromium 18.5s, mobile Chromium 17.6s. Total 1.1m.
3. npm.cmd run test:integration
   Clean replay and all 7 SQL files / 95 assertions PASS; 6 files / 16 integration tests PASS.
   Covers private Storage RLS/read/write/path/owner denial, unsigned/public-link denial,
   exact replay, modified identifiers, expiry, duplicate reservations, partial staging retries,
   800 MiB concurrent quota serialization, finalization leases/quarantine/orphan compensation,
   batch event/recipient/read-state idempotency, membership/third-user and forged-intent denial.
   Real 24 MP Chromium preparation -> limited Edge finalization PASS, no WORKER_LIMIT:
   preparedBytes=10811, storedBytes=10527, requestWallMs=195 (not total test duration).
4. npm.cmd run test -- --run: 11 files / 29 unit tests PASS, including upload state/retry limits
   and bounded private-image blobs/revocation/logout-late-response rejection.
5. npm.cmd run test:edge: 29 PASS / 0 FAIL (Deno type checking included).
6. npm.cmd run lint: PASS.
7. npm.cmd run typecheck: PASS.
8. npm.cmd run build: PASS; JS chunk 682.09 kB / gzip 197.75 kB. Existing >500 kB warning
   is nonblocking; no bundle threshold or security check was disabled.

All four desktop/mobile cases exercised actual browser preparation/direct staging upload,
rejected unsupported SVG, progress states, injected second-file network failure, failed-only retry
(three POST attempts for two successful photos), album assignment/filtering/deletion, metadata
editing, keyboard viewer, memory-photo creation/display/detach on photo deletion, both partners'
login/logout, partner read access and absence of uploader-only edit/delete controls.
Authorization denials were separately validated at SQL/Storage/Edge layers, not inferred from UI.
Existing featured-photo/home wiring and private-image cleanup implementation were reviewed;
this browser journey does not exercise the future settings-based featured-photo selection UI.

Fixture cleanup: beforeEach/afterEach guards succeeded in all four cases, including zero-object/
record assertions. Full integration later left its expected synthetic couple fixture (0|0|1|0).
After confirming Storage empty, guarded disposable-only SQL removed that fixture and reset its
operational media budget. Final read-only counts: 0|0|0|0 (photos, upload_batches, couples,
storage.objects). Auth fixture identities are intentionally retained. Neither development
(54321/54322) nor hosted databases were reset, provisioned or modified.

T056-T060 checked against these implementation/gates. T001-T060 complete (60), T061-T091
remain unchecked (31). No Gallery blockers remain. Remaining MVP/release/provider/operator
configuration is outside this remediation; no deployment performed.

Modified this turn: src/app/router.tsx, tests/e2e/gallery.spec.ts, README.md,
specs/001-private-memory-website/tasks.md and this validation document.
Evidence: artifacts/t056-gallery-pass-1.json, t056-gallery-pass-2.json and their bootstrap logs;
artifacts/t056-t060-integration-pass.json / t056-t060-integration-bootstrap.log.
Historical failures/traces retained; passing traces are not retained by configured Playwright policy.
