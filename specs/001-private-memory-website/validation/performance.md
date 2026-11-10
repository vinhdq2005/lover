# Production-preview performance — PASS, 2026-11-10

Executed npm.cmd run test:performance: 2 passed, 0 skipped, 0 failures.
This separately bootstraps the guarded disposable backend, builds Vite production output and
serves it with the actual generated Content-Security-Policy. Ordinary E2E excludes this separate
bootstrap; the performance gate is mandatory and was executed explicitly.

Fixture: 1,000 memories, 2,000 private Storage photos; 584,000 total image bytes (24×16 JPEGs),
well below the 20 MiB fixture cap. Chromium network: 10 Mbps, 100 ms latency, HTTP cache disabled.
Each profile records 15 initial usable-view samples across Home, Timeline and Gallery; Gallery
requires rendered image readiness and paginated cards, with the first lazy image scrolled into view.

| Profile | p95 | Target |
| --- | --- | --- |
| Desktop Chromium | 1,043.07 ms | <=3,000 ms |
| Mobile Chromium | 1,037.68 ms | <=3,000 ms |

The original image-readiness assertion waited on an offscreen lazy image with no Storage request.
Corrected the browser viewport step by scrolling to the first real photo; retained readiness,
card-count and timing assertions. Evidence: artifacts/t087-lazy-viewport-failure.json.
Final evidence: artifacts/t091-production-csp-performance-pass.json and performance-chromium.json /
performance-mobile.json. These measurements validate the specified small-image synthetic fixture;
they do not establish performance for full-size albums, remote services or every mobile device.
Final disposable entries/photos/batches/couples/Storage-object counts: 0/0/0/0/0.
