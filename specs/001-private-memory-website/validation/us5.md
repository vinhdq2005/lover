# US5 Diary and Letters: PASS - 2026-11-10 (Asia/Saigon)

T061-T066 complete. T001-T066 complete (66); T067-T091 remain (25).
Next feature group: profiles/shared settings, T067-T072.

## Implementation

- Migration 0014_entries.sql adds shared diary/letter entries, member-only RLS reads, no
  browser DML grants, required author/date, 200/50,000 Unicode code-point constraints and
  stable descending event_date/created_at/id index. Future dates use couple-local today.
- Entry commands use strict schemas and the existing authenticated signed-intent/receipt API.
  The trusted mutation wrapper preserves previous relationship/media command behavior. Author,
  couple and recipient remain server-derived; stale versions fail, exact replay returns its
  receipt, no-op saves emit no event, and changes notify only the partner transactionally.
- /diary provides Vietnamese shared list/detail, entry type, author, date, plain-text content,
  creation/editing and confirmed deletion, cancel behavior, loading/empty/success/error states.
  The kind select has explicit label/id association. Recoverable saves preserve the draft and
  provide reconciliation guidance; pending saves disable fields so newer edits cannot be cleared
  by an older response. Reads paginate at 30 and invalidate late responses on reload/logout.
- No secret-author mode, public sharing, external email activation or new environment variables.

## Executed gates

| Command | Actual result |
| --- | --- |
| npm.cmd run test:edge (backend checkpoint, repeated after final backend source) | 32 passed, 0 failed; Deno type checks passed |
| npm.cmd run test:integration -- tests/integration/entries.test.ts | Clean disposable replay 0001-0014, 8 SQL files / 125 assertions passed; 1 integration passed |
| npm.cmd run test -- --run (final) | 13 files / 35 tests passed |
| npm.cmd run test:e2e -- tests/e2e/diary.spec.ts tests/e2e/gallery.spec.ts | 4 passed: desktop Diary 15.8s, desktop Gallery 18.0s, mobile Diary 15.0s, mobile Gallery 18.0s; clean replay / 125 SQL assertions passed |
| npm.cmd run test:integration (full regression) | 7 files / 17 tests passed; clean replay / 125 SQL assertions passed |
| npm.cmd run lint | Passed |
| npm.cmd run typecheck | Passed |
| npm.cmd run build | Passed; JS 687.84 kB / gzip 199.05 kB; existing nonblocking >500 kB chunk warning |

The final pending-save field guard was added after the browser run and covered by an additional
unit regression; final unit/static/build checks include it. The browser suite was not repeated
after that guard-only change. No broader settings, notification or release acceptance is claimed.

## Coverage and evidence

SQL adds 30 diary assertions: both members read, outsiders see no rows, anon has no SELECT,
partner cannot issue or commit author mutations, no direct DML grant, Vietnamese/combining/emoji
round-trip, exact length bounds, whitespace rejection, local today/future date, valid kind only,
stable tied chronology/cursor, stale conflict, exact create/delete replay, no-op suppression,
and partner-only transactional notifications. Existing 95 assertions remain passing.

The real Edge integration covers near-50,000-code-point content through the actual request/body
and signing path, shared/outsider reads, partner mutation and direct-update denial, modified intent,
stale version, duplicate/no-op event behavior and deletion replay/access removal.

Browser acceptance uses two real authenticated members in the same browser, actual persisted
commands, both diary/letter types, chronology, shared reads, author edit controls, cancellation
and confirmation of deletion, partner visibility after deletion, and protected /diary after logout.
Script/image-looking input stays literal text: no injected script/img DOM nodes and no execution.
Gallery regression retains actual image preparation/direct Storage uploads, retry, viewer,
ownership and reference cleanup. The full integration suite also reran the 24 MP gate without
WORKER_LIMIT (preparedBytes 10811, storedBytes 10527, requestWallMs 198; segment, not whole test).

Unit coverage adds failed-save text preservation, code-point validation, version/resource binding,
pending-save field protection, logout-late-read rejection and stale-reload/keyset behavior.

Resolved harness failure: the first unit run had 32 passing / 2 failing tests because React Testing
Library forms remained mounted between cases (multiple 'Tiêu đề bài viết' labels). Added explicit
afterEach(cleanup) to the new component/hook suites; assertions remain strict. The final run has
35 passes and no unresolved failures. This was corrected within the user's harness-fix authorization.

Preserved machine-readable reports:
- artifacts/t061-t066-browser-pass.json
- artifacts/t061-t066-browser-bootstrap.log
- artifacts/t061-t066-integration-pass.json
- artifacts/t061-t066-integration-bootstrap.log

## Environment and remaining setup

Only the guarded lover-integration project (.test-stack, ports 55321/55322) was used for database
tests. beforeEach/afterEach cleanup ran for all browser cases. After full integration, confirmed
Storage empty and removed its remaining synthetic relationship fixture using the guarded helper.
Final read-only counts: entries/photos/upload_batches/couples/storage.objects = 0/0/0/0/0.
Synthetic Auth identities intentionally remain. The development project on 54321/54322 and all
hosted resources were untouched; no production provisioning or deployment occurred.

No new configuration is needed for disposable tests. To preview Diary in the existing development
app, an operator must apply 0014_entries.sql without resetting that database and run the updated
Edge API/frontend. This has not been performed here. Hosted migration/Edge deployment, sender
verification and Netlify release setup remain operator steps for later release work.

No blockers for US5. Extension hooks were checked before/after implementation;
.specify/extensions.yml is absent, so none were dispatched.
