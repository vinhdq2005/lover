# Local release validation — PASS, 2026-11-10

T073–T091 accepted; T001–T091 complete. No deployment, external email, production provisioning,
development database reset or production/development data modification was performed.
All database tests use the guarded lover-integration project on loopback 55321/55322.

## Executed commands and results

| Command | Actual result |
| --- | --- |
| npm.cmd ci | Installed successfully; 0 audit vulnerabilities |
| npm.cmd run test:integration | 21 passed, 0 failed; clean replay 0001–0017 and 189 SQL assertions passed first |
| npm.cmd run test:e2e | 23 passed, 1 pre-existing mobile enrollment skip, 0 failures |
| npm.cmd run test:performance | 2 passed; production build and generated CSP, desktop/mobile |
| npm.cmd run test -- --run | 46 passed in 17 files |
| npm.cmd run test:edge | 42 passed, 0 failed; Deno type checks passed |
| npm.cmd run lint | Exit 0 |
| npm.cmd run typecheck | Exit 0 after correcting duplicate Playwright config property |
| npm.cmd run build | Exit 0; TypeScript, Vite, bundle inspection, generated hosting headers |
| npm.cmd run check:build | Exit 0; all 4 output files inspected |

Final unit/Edge/lint/typecheck/build checks ran after a clean npm ci. The existing Vite >500 kB
chunk warning remains: JS 700.93 kB, 203.39 kB gzip. No threshold was increased to hide it.
Final static validation caught a duplicated testIgnore property in playwright.config.ts (TS1117);
removed the duplicate, preserving the same separate performance selection, then typecheck/build
and bundle inspection passed. Performance and ordinary browser suites had already executed
their intended cases; the duplicate did not change selection behavior.

## Security and acceptance evidence

| Boundary | Exercised behavior |
| --- | --- |
| Auth/enrollment | Anonymous/expired/outsider denials, controlled couple/invitation, third-member prevention; both partners authenticate and logout removes private-page access |
| SQL/RLS | Same-couple reads, author/own-profile writes, shared settings, stale-version rejection, signed actor/payload/resource/upload intent and replay/expiry tests |
| Private Storage | Authorized reserved paths, outsider reads/writes denied, staging unreadable, quotas, 24 MP browser processing to <=1600px, finalization, idempotency and partial retries |
| Notifications | Recipient-only inbox and minimized batch summaries; actor/outsider denial; one batch notification/email disposition despite later successes; read state persists |
| Email worker | Mocked provider only; current verified partner/consent, 20-row leases, 100/day cap, 5 attempts, stable keys, uncertainty quarantine after 30 min, fixed redacted errors |
| Sender-disabled mode | No provider call; durable in-app notice, email disabled reason and opt-in UI remain functional; no historic replay |
| Retention | Expired operational rows purged; saved text/letters/ready photos and profiles preserved; capacity warnings/blocking tested |

Desktop/mobile Gallery, Diary, Settings, notification inbox and private-route journeys passed.
Notification browser quota/failure/unknown/accepted states are explicit local administrative
simulations; provider HTTP failures are separately mocked in Edge tests. No real delivery is claimed.
See us7.md, accessibility.md, performance.md and prior story validation documents for details.

Backup restore integration exports data from the prepared disposable schema plus Auth identities,
downloads private media, encrypts/authenticates the archive, empties only the guarded disposable
tables, restores data, reuploads media and verifies SHA-256, Unicode memory/letter content, both
members' access and outsider denial. This passed in the full 21-test run. It is data-only recovery
onto an already-migrated schema, not proof of production managed-role/full-server recovery.
The first local pg_restore failed under non-superuser postgres; guarded local restore now uses
the verified disposable supabase_admin role. No production role changed. See docs/backup-restore.md.

Final cleanup query: entries=0, photos=0, upload_batches=0, couples=0, storage.objects=0.
Reports: artifacts/t091-all-integration-pass.json, t091-all-browser-pass.json,
t091-production-csp-performance-pass.json and integration-bootstrap.log.
Resolved intermediate failures are retained in us7.md and accessibility/performance evidence.

## External operator setup, not performed

1. Review/apply pending migrations through 0017 without resetting existing data. Configure private
   buckets, controlled Auth identities/signup restrictions and exact app/redirect origins. Deploy
   api, maintenance and notification-worker only in a later authorized release; configure server-only
   service/operation/worker secrets. No privileged key may have a VITE_ prefix.
2. Configure Vault lover_edge_base_url and lover_worker_secret for scheduled recovery. Missing Vault
   values cause no outbound request. Verify recovery after deployment with synthetic authorized data.
3. Keep email off unless actual Brevo sender approval/free allowance is verified. netlify.app is not
   sender-domain authority. Only then configure server-only provider keys/From settings and
   EMAIL_DELIVERY_ENABLED/EMAIL_SENDER_VERIFIED, enable private.notification_config and obtain
   recipient opt-in. If unavailable, remain in-app-only. See docs/email-operations.md.
4. Configure Netlify Free public Supabase URL/key for production; previews require a distinct
   isolated Supabase origin, LOVER_PREVIEW_ISOLATED=true and LOVER_PRODUCTION_SUPABASE_ORIGIN.
   Verify HTTPS, SPA routing, generated CSP/headers after a future authorized deployment.
5. Execute manual encrypted export/rotation and isolated restore with the intended operator
   credentials; review free-tier quotas/pause behavior weekly. No paid fallback is enabled.

No unresolved mandatory code/test blocker remains. Account-specific sender approval, real hosted
operation and operator disaster recovery remain external release steps, not automated pass claims.
