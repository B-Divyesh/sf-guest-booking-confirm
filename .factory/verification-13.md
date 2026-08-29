# Guest Booking Confirm — independent verification: **FAIL**

Date: 2026-08-29  
Work order: `guest-booking-confirm-verify-13`  
Candidate: `b7399716331e77abb237c08af39e19efaa42af72`  
Live URL: <https://guest-booking-confirm.sociobot.in>

## Decision

**FAIL — do not release or promote this deployment.** The live `/health`
response identifies exactly the requested candidate, and the corrected cold
landing page now passes the plain-words and one-click-demo gate. All local
quality gates and all 21 declared claim commands pass. However, the deployed
write-rate boundary is not enforced: a single fresh client exceeded the
documented 12-write allowance without a `429` or `Retry-After`. This violates
the required backend contract, including the license/unlock endpoint, and is a
release blocker.

## Required first-read result — PASS

I opened the live root in a new 390 px browser context before interacting. The
first screen says **“Request and confirm guest appointments.”** It says this
is **“For microbusinesses that approve time requests before each guest gets a
clear booking status.”** The primary visible action is **“Try it with sample
data”**, with the explicit outcome “Opens Maya’s approved request at the guest
confirmation step.” It therefore answers what it does, for whom, and what to
click first in plain words. The action opens `/demo` in one click.

## Release blocker

### P1 — live write and unlock routes do not enforce the per-client allowance

The compiled source sets every non-GET API route to a 12-request rolling
one-second allowance and sends `429 Retry-After: 1` when it is exceeded. A
fresh local server from this checkout behaves correctly: 14 concurrent
`POST /api/page-view` requests from one `X-Forwarded-For` value returned
**12 × 204 and 2 × 429**, with `Retry-After: 1`.

Fresh production evidence for the exact live candidate is different:

| Endpoint and one fresh client | Expected | Observed |
| --- | --- | --- |
| 45 concurrent `GET /api/public/settings` | 40 success, then 429 | **40 × 200; 5 × 429**, each `Retry-After: 1` |
| 14 concurrent `POST /api/page-view` | 12 × 204, then 429 | **14 × 204; 0 × 429** |
| 25 concurrent `POST /api/page-view` | 12 × 204, then 429 | **25 × 204; 0 × 429** |
| 14 concurrent `POST /api/license/verify` with `{}` | 12 normal rejections, then 429 | **14 × 422; 0 × 429** |

The `/api/license/verify` input is deliberately malformed, so no license
lookup or paid-state change occurred. The page-view requests only incremented
the product's documented anonymous daily aggregate counter. The contrast with
the fresh local result makes this deployment/topology behavior, not a source
test failure. Do not accept the release until a fresh live burst has exactly
12 write responses followed by `429 Retry-After: 1` (and the 40-read boundary
continues to hold) for one client.

## Mandatory claims — PASS (21/21)

From this clean checkout I ran every `test` entry in `.factory/claims.json`:

- The 14 configured Playwright claim commands, each invoked as
  `npm run test:e2e -- --grep @claim:<id>`, passed. They cover the demo trail,
  local-only storage, offline reload, no cookies, guest/owner flow,
  reschedule/cancel, ICS, reminder checklist, read limiter, Entra sign-in, and
  browser license handling.
- The six exact locked Rust claim commands passed: anonymous page views, free
  and paid capacity/retention, revoked-license fallback, artwork provenance,
  and the container contract.
- `npm run test:billing` passed the live no-purchase Sociobot checkout smoke
  for the exact USD 29.00 Panel Pro license.

The full `npm run test:e2e` rerun also passed **22/22** tests.

## Local quality gates — PASS

- `npm ci`: completed cleanly (85 packages; audit reported 0 vulnerabilities).
- `npm test`: PASS — 4 Vitest tests, 20 Rust tests, claims contract, and five
  deployment/release contract tests.
- `npm run check`: PASS — TypeScript plus Clippy with warnings denied.
- `cargo fmt --all -- --check`: PASS.
- `npm run build`: PASS and produced `dist/`.
- `cargo build --release --locked`: PASS (produced the 14 MB release binary).
- Initial main JS is 49,006 bytes raw / 14,928 bytes gzip; initial CSS is
  36,877 bytes raw / 8,403 bytes gzip. The 260,119-byte auth module is lazy
  loaded (65,459 bytes gzip), so initial JS is comfortably below the 200 KB
  static budget.
- A port-only runtime startup used the `/data` SQLite default, returned health,
  and logged graceful SIGTERM shutdown.

## Product, privacy, accessibility, and deployment checks

- Live `/health` returned `200` and
  `{"build_sha":"b7399716331e77abb237c08af39e19efaa42af72","status":"ok"}`.
- The real guest flow is covered locally: request without an account, owner
  approval, guest confirmation, ICS export, reschedule/cancel, manual
  reminder recording, invalid inverted opening hours with recovery, and
  concurrent confirmation/approval behavior all pass in the Rust and
  Playwright suites.
- In a fresh live 390 px demo context, confirmation produced no action
  request, no cookie, no console/page error, no failing response, and only
  `demo:guest-booking-confirm:state` in localStorage. All observed landing and
  demo requests were same-origin.
- Live Playwright axe 4.10.2 found no serious or critical violations on `/` or
  `/demo`. The 22-test suite also verifies keyboard skip/focus, 44 px demo
  targets, reduced motion, 200% text reflow at 390 px, and desktop/mobile
  accessibility.
- A live service worker controlled `/demo`; after a cached reload, offline
  reload retained the ready-to-confirm demo with no console error.
- Live root response headers include CSP with response-header
  `frame-ancestors 'none'`, `nosniff`, `X-Frame-Options: DENY`, same-origin
  referrer policy, and denied camera/microphone/geolocation. HTML is
  `no-cache`; the hashed main JS is `public, max-age=31536000, immutable`.
  Internal landing links, `/privacy`, `/terms`, `/manage`, `/demo`, and
  `/health` returned 200; an unknown route returned the designed 404.
- Live owner entry has no password field and identifies Sociobot Microsoft
  Entra External ID. Its sign-in discovery request targets
  `sociobotcustomers.ciamlogin.com` with the expected tenant id.

## Defects by severity

- **P1 (release-blocking):** Production accepts more than the allowed 12
  writes per client per rolling second and fails to return `429 Retry-After` on
  the `/api/page-view` and `/api/license/verify` routes. Local source passes
  the same boundary, so investigate the deployment topology/routing/persistent
  rate-limit state before retrying release.

No product code was changed during this verification. This report updates the
previous failed verification with fresh evidence for the requested candidate.
