# Lover - Our Story

Private Vietnamese relationship-memory app for two authorized accounts. Authentication,
controlled enrollment, relationship counters and the text timeline are implemented.
Private photo uploads, gallery, albums, memory-photo integration and shared diary/letters have passed acceptance.
Browser image preparation preserves the 24 MP/10 MiB source limits and 1600 px stored-image limit;
the actual Edge finalizer independently validates prepared images. Desktop and mobile Gallery
journeys pass on consecutive runs, including logout/partner switching and private-route protection.
T001-T091 are complete, including profiles, shared settings, recipient-only notifications,
optional email, operational retention and local release validation.
Evidence: specs/001-private-memory-website/validation/release.md.
Previewing new features in an existing development database requires pending migrations through
0017_notification_maintenance.sql; validation applied them only to the disposable project without
resetting or updating development data.

## Local development

Node 22.12+ (26.13 used for validation), Docker Desktop and npm are required.

1. npm ci
2. Configure an existing local Supabase instance with the approved migrations (apply pending
   migrations without resetting data; operator action).
3. node scripts/local-config.mjs (writes ignored LOCAL keys only; never prints them)
4. npx supabase functions serve --env-file .env.edge.local --no-verify-jwt
5. npm run dev

Open http://127.0.0.1:5173. Only the public URL/key enter the browser; Edge handlers verify Auth
identity themselves. No public signup or hosted provisioning runs automatically. Use
docs/operator-enrollment.md for the two controlled identities. Email defaults to disabled.

## Validation

npm run typecheck; npm run lint; npm run test -- --run; npm run test:edge; npm run build

npm run test:integration automatically starts a separate disposable Supabase project
lover-integration under ignored .test-stack/ on ports 55321/55322. Global setup replays migrations
and runs SQL assertions before any tests, then waits for Auth/schema/Edge readiness. It never resets
the development database or a linked/hosted project. Repeated runs recreate synthetic fixtures;
concurrent runs are refused by a lock. Full assertion reports are in artifacts/integration-results.json
and redacted setup/service logs in artifacts/integration-bootstrap.log.

For just the Storage gate: npm run test:integration -- tests/integration/storage.test.ts
tests/integration/migrations.test.ts (one command on one line).
Stop the disposable stack when finished with npx supabase stop --workdir .test-stack.
Browser tests now use the same disposable backend and a separate Vite application on 127.0.0.1:5175,
with public test-only configuration and its own exact CORS origin. They do not reuse or reset the
development database. npm run test:e2e -- tests/e2e/gallery.spec.ts runs the Gallery acceptance gate.
Run npm run test:e2e for the ordinary acceptance suite, then npm run test:performance for the
separate bounded production-preview performance gate. Do not run database suites concurrently.
The latter serves the built app with its generated CSP, using 1,000 memories and 2,000 tiny photos.

npm run test:image-runtime checks browser preparation of a 24 MP source and validation in the
actual local Edge worker. Keep Vite and the local functions server running for this command.
See specs/001-private-memory-website/validation/image-resource-gate.md.

Nothing has been deployed. Never configure privileged or Brevo keys as VITE_ variables.
Email stays disabled unless server configuration, sender eligibility and recipient consent all
permit delivery; the in-app inbox always works. See docs/email-operations.md and
docs/backup-restore.md for manual setup. Netlify previews require a separate Supabase origin,
LOVER_PREVIEW_ISOLATED=true and LOVER_PRODUCTION_SUPABASE_ORIGIN; builds fail closed otherwise.
