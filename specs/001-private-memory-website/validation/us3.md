# US3 counter increment evidence

- Fixed-date and timezone tests cover start day zero, leap-year day-365 versus yearly anniversary,
  February-29 recurrence, distinct first-meeting labels, and couple-local midnight refresh.
- Shared relationship date/version checks and future/stale update rejection: SQL tests passed.
- Counter display and first-meeting settings: desktop and mobile browser tests passed.
- Custom milestone schema, commands and minimal settings UI are implemented.
- Initial home uses profile/photo placeholders; featured imagery awaits US4. Recent text memories
  are wired in the US2 increment. Full MVP home/media acceptance remains a release requirement.

Remediation executed 2026-11-08: unchanged milestone saves preserve version/updated_at and emit no
event/notification, including a new operation from the partner. Exact retries keep one receipt;
an actual change plus replay increments/emits once. Stale versions and modified-hash replays fail.
SQL tests cover valid leap day, invalid leap day and couple-local today/tomorrow. All passed.

Current core totals: 20 unit tests, 22 standalone Edge tests and 56 SQL assertions pass.
Three integration tests and the full browser suite (11 pass, one explicit skip) also passed.
The actual image worker gate now passes for browser-prepared media; see image-resource-gate.md.
