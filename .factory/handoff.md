# Guest Booking Confirm — verification 10 handoff

Date: 2026-08-29

Work order: `guest-booking-confirm-verify-10`

Candidate: `bacb76f118db1a65945eb83b67437a7f703cf19a`

Live URL: <https://guest-booking-confirm.sociobot.in>

Full report: `.factory/verification-10.md`

## Status

**FAIL — do not release this deployment.**

Candidate source and all 19 mandatory claim commands pass. Live build identity,
core behavior, accessibility, privacy, and build gates pass. The live API does
not enforce its documented 40-read/12-write per-client allowance.

## Release blocker

Three fresh 41-read bursts each returned 41 × 200. Three 13-write bursts each
returned 13 × 204. Larger sub-second bursts allowed exactly 80 reads and 24
writes before 429, consistent with two separately limited replicas. Thirteen
live product license-verification calls also crossed the write boundary without
429. This violates the one-replica SQLite contract and doubles the allowance.

Evidence:

- `.factory/verification-artifacts/live-rate-limit-three-repetitions.json`
- `.factory/verification-artifacts/live-rate-limit-repeat.json`
- `.factory/verification-artifacts/backend-audit.json`
- `.factory/verification-artifacts/deployment/hash-parity.tsv`

## Verified

- Every `.factory/claims.json` command individually: 19/19 PASS.
- Unit/integration/claims, TypeScript, Clippy, formatting, locked release build,
  exact Vite build, dependency audit, and 22/22 Playwright tests: PASS.
- Fresh real UI/API flows: setup, invalid input and recovery, request, approval,
  confirmation, ICS, reminder, reschedule, cancellation, concurrent state
  changes, and restart persistence: PASS.
- PORT-only runtime, Entra authority, DST boundaries, local rate limits, and a
  100-request smoke: PASS.
- Live desktop/390 px, 200% text, keyboard, focus, reduced motion, axe,
  console/page errors, privacy requests, headers, caching, PWA offline/update,
  link crawl, bundles, and Lighthouse: PASS.
- Live `/health` returns the candidate SHA and all deployed artifacts match the
  local build by SHA-256.

No product code was modified. Only verification records and evidence were
added.

## Reproduce local gates

```sh
npm ci
npm test
npm run check
cargo fmt --all -- --check
cargo build --release --locked
npm run build
npm audit --omit=dev
npm run test:e2e
```

## Next step

Enforce one serving replica (`minReplicas=1`, `maxReplicas=1`) before traffic,
then repeat live cache-busted 41-read, 13-write, and 13-license-route bursts.
Acceptance requires 40/12 successes followed by `429` with `Retry-After: 1`.
If multiple replicas are required, move bookings and limiter events to shared
transactional storage and reverify concurrency and persistence.
