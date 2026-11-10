# US7 partner inbox and optional email - PASS (2026-11-10)

T073-T083 accepted; T084 retention/help also validated. Email remains globally disabled and no
real email was sent. Per-user email consent defaults off and does not disable the in-app inbox.

Executed: npm.cmd run test:edge (42 passed); npm.cmd run test -- --run (43 passed);
npm.cmd run lint / typecheck / build (passed; existing >500 kB warning remains).
Clean disposable replay through 0017 passed with 189 SQL assertions. The full
npm.cmd run test:integration passed 20 tests in 9 files after fixture isolation correction.
Focused notification integration passed 2 tests (real RLS, concurrent claims, quotas, 30-minute
uncertainty quarantine and one email disposition per partially completed upload batch).

npm.cmd run test:e2e -- tests/e2e/notifications.spec.ts tests/e2e/settings.spec.ts
tests/e2e/gallery.spec.ts tests/e2e/diary.spec.ts (one command) passed all 8 desktop/mobile cases.
The expanded npm.cmd run test:e2e -- tests/e2e/notifications.spec.ts passed 4 cases: recipient-only
inbox/read/consent and clearly mocked failure/quota/unknown/accepted status fixtures on both sizes.
Actual provider/network errors are exercised through injected HTTP responses in Edge tests;
browser status fixtures are administrative local simulations, not evidence of real mail delivery.

Implemented safe inbox RPC (no raw batch/delivery SELECT), actor exclusion, strict same-couple
notification/event/batch/recipient joins and field-minimized batch summaries; signed recipient
read/retry/preference commands; visible-only 60-second polling and logout response invalidation.
Disabled history never replays. New pending email requires server DB enablement + recipient opt-in;
actual sending additionally requires server env/provider/verified-sender gates. Worker rechecks the
current verified recipient, claims <=20 with exclusive leases, atomically budgets <=100 attempts/day,
uses <=5 attempts and fixed stable keys. Unknown outcomes beyond the first-attempt 30-minute window
stay quarantined. Later batch success changes counts but not notification ID/read state/email job.
Post-commit wake-ups and one-minute recovery share leases; wake-up failure never rolls back content.

189 SQL checks include old assertions, recipient/field-minimization/ownership cases, max-20 claims,
exclusive active leases, budget reservation, expired dedupe and exhausted-fifth-attempt quarantine,
90-day operational pruning while preserving saved content/ready media, receipt expiry+24h,
and 350/400 MB capacity thresholds. At 400 MB, new content/batches and non-delete events are stopped;
deletion, read status and recovery remain usable. RetentionHelp exposes the policy and warning.

Resolved failures (not bypassed):
- Initial worker type check used ReturnType of generic createClient, inferring unusable RPC types;
  replaced injected client type with SupabaseClient. Final Edge checks passed.
- Initial foundation SQL lost in-app notices because the new emitter wrongly required recipient
  email confirmation. Corrected the emitter/recipient guard so in-app follows current membership;
  email alone rechecks verification. Original foundation assertions now pass unchanged.
- First full integration run had 19 passed / 1 failed with HTTP 429 in maintenance photo.delete.
  Independent cases shared the synthetic user's 30/min issuance window. Added guarded per-case
  operational rate-fixture reset. The actual rate function/limit and SQL 31st-request-denial
  assertions remain unchanged. Full rerun passed all 20. Evidence: t073-first-sql-failure.log and
  t073-rate-window-failure.json under artifacts/.

Passing reports: artifacts/t073-t083-browser-regression-pass.json,
t073-t083-notification-browser-pass.json, t073-t083-integration-focused-pass.json,
t073-t084-full-integration-pass.json and t073-t084-full-bootstrap.log.

Only the guarded lover-integration project was reset/modified. No development/production data,
Vault values, sender accounts or external services were changed. docs/email-operations.md records
current primary-provider references and required operator eligibility proof. A netlify.app hostname
is not sender-domain authority. Five-minute delivery is conditional; accepted is not delivered.
Account-specific From approval and a real sender test remain external/manual and were not claimed.

Final release regression: 189 SQL assertions, 21 integration, 46 unit and 42 Edge tests passed;
ordinary browser suite 23 passed with 1 pre-existing mobile enrollment skip, plus 2 separate
production-CSP performance cases. Lint/typecheck/build/bundle inspection passed after clean npm ci.
See release.md for actual commands, resolved release-check defects and external setup boundaries.
