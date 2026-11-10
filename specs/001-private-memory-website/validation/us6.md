# US6 Profiles and Shared Settings: PASS - 2026-11-10 (Asia/Saigon)

T067-T072 complete. T001-T072 complete (72); T073-T091 remain (19).
Next group: partner inbox and optional email infrastructure.

## Implementation and compatibility

- 0015_profiles_settings.sql wraps the existing trusted mutation RPC; unrelated relationship,
  milestone, memory, diary, album and upload behavior is preserved. Browser write grants/RLS
  are unchanged. Profile actor and couple are server-derived; email/identity fields cannot be
  edited. Display/shared names use the existing 1-100 Unicode-code-point schemas/constraints.
- Avatar references must be ready, same-space and uploaded by that actor. Either member may
  select any same-space ready featured photo. The couple lock serializes reference changes
  against photo deletion. Stale versions fail; exact receipts replay without another event;
  unchanged resolved settings do not version/notify. Both update directions notify only partner.
- Vietnamese own/shared forms reuse RelationshipSettings and MilestoneSettings. Pickers use
  ready Gallery reads, own-upload filtering for avatar, explicit accessible select labels,
  pagination, clear selection, missing-image guidance and server validation at commit.
- useSettings.tsx provides one private profile reader across routes. Local successful commands,
  focus and visibility restoration refresh settings. useCouple and profile reads invalidate
  older requests/logout responses; version checks prevent older state restoring deleted media.
  Home shows both names and private avatars/placeholders; timeline/diary authors use those names.
- Dirty forms keep the original draft/version when background data changes, preserving conflict
  detection. Explicit reload reconciles the draft. New submissions clear previous success banners,
  errors preserve text, and pending saves disable inputs. Existing authenticated logout is reused.
- No new environment variables, public media, email activation, dependencies or deployment.

## Actual validation

| Command | Result |
| --- | --- |
| npm.cmd run test:edge | 35 passed / 0 failed, Deno checks passed (also repeated at final checkpoint) |
| npm.cmd run test:integration -- tests/integration/settings.test.ts | Clean replay 0001-0015, 9 SQL files / 147 assertions passed; 1 real settings integration passed |
| npm.cmd run test -- --run | 15 files / 42 tests passed, repeated after final form feedback correction |
| npm.cmd run lint | Passed, repeated after final correction |
| npm.cmd run typecheck | Passed, repeated after final correction |
| npm.cmd run test:e2e -- tests/e2e/settings.spec.ts tests/e2e/gallery.spec.ts tests/e2e/diary.spec.ts | 6 passed: desktop Diary 15.1s, Gallery 18.1s, Settings 16.3s; mobile Diary 14.9s, Gallery 17.4s, Settings 15.7s; clean replay / 147 SQL assertions passed |
| npm.cmd run test:integration | 8 files / 18 tests passed, including all previous upload/Storage/Diary/API denial gates; clean replay / 147 SQL assertions passed |
| npm.cmd run test:e2e -- tests/e2e/settings.spec.ts | Final feedback correction accepted: desktop 16.3s + mobile 15.7s, 2 passed; clean replay / 147 SQL assertions passed |
| npm.cmd run build | Passed; final JS 695.01 kB / gzip 200.90 kB. Existing >500 kB chunk warning remains nonblocking |

147 SQL assertions comprise the previous 125 plus 22 settings checks. They cover own-profile
updates, untouched partner identity, partner notification, duplicate/no-op suppression, stale
versions, foreign/unknown/deleting image references, outsider denial, 100/101-code-point limits,
denial of direct profile/shared writes and compatibility of existing relationship updates.
The new real API integration uploads/finalizes an actual JPEG and checks schema identity injection,
partner-avatar denial, either-member featured selection, shared optimistic conflicts, replay,
no-op events, outsider reads/issuance and denial of a deleted-photo reference.

Unit additions cover Vietnamese forms, own/partner edit controls, own versus shared photo options,
failed-save draft preservation, unchanged relationship command payload, dirty draft/original-version
preservation, and late profile/couple response rejection after newer versions or logout.
Browser acceptance verifies both identities, name/avatar/featured display on Home, shared name
updates in both directions, preserved relationship fields, milestone creation, and photo deletion
clearing Home images. Gallery and Diary actual browser workflows passed unchanged alongside it.
The full integration also reran actual 24 MP preparation/finalization without WORKER_LIMIT:
preparedBytes=10811, storedBytes=10527, requestWallMs=170 (measured request segment).

## Resolved environment failure

The first settings integration attempt exited before migration replay/test collection because
Docker Desktop's Linux engine was stopped. docker info reported:

```text
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

The runner's secondary 'No test files found' message did not mean the settings test was missing;
the file existed and global setup aborted before collection. Inspected docker desktop start --help,
then docker desktop start --timeout 60 succeeded. Retried the unchanged disposable bootstrap,
which passed. No unresolved security/test failure remains. No assertions were bypassed, RLS
weakened, tests disabled or timeouts raised to obtain these results.

## Cleanup, evidence and operator setup

All database gates used the marked .test-stack lover-integration environment (55321/55322).
Browser beforeEach/afterEach cleanup succeeded across both runs. Final guarded read-only counts:
entries/photos/upload_batches/couples/storage.objects = 0/0/0/0/0. Synthetic Auth identities remain.
No development (54321/54322) or hosted database was reset or updated by this implementation.

Preserved reports:
- artifacts/t067-t072-browser-pass.json and t067-t072-browser-bootstrap.log (six-case regression)
- artifacts/t067-t072-settings-final-pass.json and t067-t072-settings-final-bootstrap.log (final two cases)
- artifacts/t067-t072-integration-pass.json and t067-t072-integration-bootstrap.log (full regression)

To preview this feature outside disposable tests, the operator must apply pending migrations
through 0015_profiles_settings.sql without resetting existing data, then run the updated Edge API
and frontend. No new secrets or sender settings are needed. Production migration/deployment,
provider verification and release configuration remain future operator actions, not performed here.

The SettingsProvider requires JSX, so the planned useSettings.ts path is implemented as
useSettings.tsx; tasks.md reflects that extension without changing functional requirements.
Checklist requirements.md was inspected read-only (16 checked, 0 unchecked). Existing ignore files
cover env/dependency/build/test-stack artifacts; package remains private. Extension hooks were
checked before/after implementation; .specify/extensions.yml is absent, so none were dispatched.
