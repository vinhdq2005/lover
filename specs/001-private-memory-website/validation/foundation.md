# Foundation implementation evidence

Validated on 2026-11-08 locally with Node 26.13.0, Docker and Supabase CLI.
- TypeScript typecheck, ESLint and Vite production build pass.
- 20 unit tests and 22 standalone Edge tests pass.
- Three integration tests pass: clean migration replay, concurrent enrollment and real Edge API security.
- 56 SQL assertions pass, including RLS, grants, transaction rollback, receipts, rate limiting,
  milestone no-op/replay/date boundaries and scope/owner checks.
- Latest full browser suite: 11 pass, 1 explicit mobile enrollment skip; desktop enrollment is covered.
- npm dependency audit reported zero vulnerabilities at installation.

I6 clarified in tasks.md: live inbox projection assertions run in US7, not US4.
The actual Edge image gate now passes with browser preparation of the 24 MP source (worker 77 ms).
Raw larger inputs are rejected with 422 before decoding. See image-resource-gate.md for the
processing contract and its full-resolution-source limitation.
No upload publication or production deployment is enabled. T047-T091 remain unchecked.

Coverage remediation: injectable API boundary tests exercise CORS, authentication-before-dispatch,
JSON limits, fixed status handling and exception redaction. They simulate downstream error statuses;
the separate local HTTP integration test verifies actual Auth/RPC/Edge behavior for invalid sessions,
outsiders, forged fields/client hashes, modified payloads, concurrent exact commits and valid-signature
expired operations after receipt removal. SQL tests exercise the real issuance rate limiter.
Future upload identifiers are bound in signing-unit tests; their actual handlers await US4.
Migration-order unit tests reject missing prerequisites; clean PostgreSQL replay resolves actual
table/function dependencies, with media table presence assertions activated once T049/T050 exist.
