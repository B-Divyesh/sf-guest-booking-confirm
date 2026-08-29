# Guest Booking Confirm — verification 11 handoff

Date: 2026-08-29

Work order: `guest-booking-confirm-verify-11`

Candidate: `c91a921ed8f6c7f3dd77db42d46bb9491775e6c6`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Status

**FAIL — do not release.** The live `/health` build identity is exactly the
candidate, but the deployed backend breaks the documented per-client request
allowance. This is a P1 deployment failure, not a source-build failure.

## Exact fresh evidence

- Five fresh 41-request read bursts to `/api/public/settings` each returned
  **41 × 200**, rather than 40 × 200 followed by 429.
- A fresh 45-request `POST /api/page-view` burst returned **24 × 204 and
  21 × 429**, every 429 with `Retry-After: 1`; source allows only 12 writes.
- This points to two independently limited replicas with local SQLite state.
  It violates the single-replica persistence/rate-limit contract and can split
  booking state.

All other fresh checks passed: 19/19 claim commands after `npm ci`, `npm test`,
TypeScript/Clippy/format, locked release build, Vite production build, live
demo/privacy/headers, mobile/keyboard/reduced-motion flows, and axe serious/
critical scans. One first complete E2E run flaked in the mobile guest setup;
the exact claim and a following full 22/22 run passed. Docker is unavailable in
this verifier container.

Read the full independent evidence and defect list in
`.factory/verification-11.md`.

## How to reproduce the blocker

```sh
# Use a new X-Forwarded-For value each time; issue 41 concurrent GETs.
# The bad live deployment accepts all 41 instead of returning one 429.
GET https://guest-booking-confirm.sociobot.in/api/public/settings
```

## Required next step

Enforce one active, one running replica (`minReplicas=1`, `maxReplicas=1`) or
use shared transactional storage for bookings and the limiter. Then rerun
multiple live cache-busted bursts: exactly 40 reads and 12 writes must succeed;
the next request must be `429` with `Retry-After: 1`.
