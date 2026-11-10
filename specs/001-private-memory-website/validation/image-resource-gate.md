# Image runtime gate: PASS with browser preparation

Executed locally on 2026-11-08. Synthetic images only; no hosted service, production credentials,
email, bucket or upload publication route was created. Supabase worker limits remain 256 MB,
CPU soft/hard 1000/2000 ms. The previous raw 24 MP decoding path returned 546 WORKER_LIMIT.

## Resolution and measured results

Browser accepts <=10 MiB / <=24 MP JPEG/PNG/WebP, checks headers before decode, applies orientation,
and produces a metadata-free JPEG <=1600 longest edge (white background for transparency).
This compressed copy is the saved photo; full-resolution source bytes are not retained.
Reserve/upload the prepared bytes once and keep that File for retries. Browser preparation is
not trusted validation: the server independently inspects and fully decodes the smaller file.
Raw larger dimensions fail 422 before decoder allocation, protecting malicious direct callers too.

Actual `npm run test:image-runtime` results (exit 0):

| Case | Input | Result |
| --- | --- | --- |
| Browser preparation | 6000 x 4000, 24 MP JPEG, 140912 bytes | 1600 x 1066 JPEG, 10811 bytes |
| Worker warmup | 24 x 16 JPEG, 290 bytes | HTTP 200, validation 5 ms |
| Prepared 24 MP source in worker | 1600 x 1066 JPEG, 10811 bytes | HTTP 200, validation 77 ms |
| Direct raw-source bypass | 6000 x 4000 JPEG, 140912 bytes | HTTP 422, no full-resolution decode |

Passing is evidence for this measured preparation/decoder path, not all future images or upload
integration. No worker limits were increased. Standalone Deno time/RSS is not worker evidence.
Secure Storage/reservation/finalization integration and end-to-end media authorization remain T047+.

## Reproduction

Start Docker and local Supabase; generate ignored local configuration with
`node scripts/local-config.mjs` only if needed (it replaces local signing keys). Keep two terminals
running `npx supabase functions serve --env-file .env.edge.local --no-verify-jwt` and `npm run dev`.
Then run `npm run test:image-runtime`. Chromium must be installed via
`npx playwright install chromium`. The command uses the real prepareImage browser module.

The probe checks a loopback CLI API URL, provisions synthetic local test identities, authenticates
through Auth, and temporarily instruments only api/handler.ts with an additional local-origin and
worker-secret check. The handler is restored in finally; no probe route remains. Result JSON is
written under ignored artifacts/. No images are published. Never run against hosted resources.

Browser regression: `npm run test:e2e -- tests/e2e/image-preparation.spec.ts`.
Desktop and mobile Chromium passed preparation and invalid/oversized-source rejection.
Standalone Edge tests cover actual JPEG/PNG/WebP decoding, spoofing/corruption/animation,
source/stored dimension bounds and preview generation.
