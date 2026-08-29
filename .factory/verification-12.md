# Guest Booking Confirm — independent verification: **FAIL**

Date: 2026-08-29
Work order: `guest-booking-confirm-verify-12`
Candidate and deployed build: `23cb8cc4f991ef2d01a02f3f3b9bea4fb135f069`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Decision

**FAIL — do not release.** The live `/health` response identifies exactly the
candidate commit. Local quality gates and every declared claim test pass, but
two independent release gates fail: the cold landing page does not state the
product's job and audience in plain words, and production does not enforce the
single-client rate limits. The latter also indicates split SQLite-backed state
between serving replicas.

## Release blockers

### P1 — production rate limiting and persistence boundary are split

The candidate source applies one rolling-window counter per SQLite database:
40 GETs and 12 non-GET requests per forwarded client, with `429` and
`Retry-After: 1` after the allowance. Fresh production evidence on 2026-08-29:

| Burst against one fresh `X-Forwarded-For` value | Expected | Observed |
| --- | --- | --- |
| 41 `GET /api/public/settings` (single burst) | 40 × 200, then 429 | 40 × 200, 1 × 429 (`Retry-After: 1`) |
| five independent 41-read bursts | 40 × 200, then 429 each | **41 × 200, 0 × 429 in every burst** |
| 13 `POST /api/page-view` | 12 × 204, then 429 | **13 × 204, 0 × 429** |
| 25 `POST /api/page-view` | 12 × 204, then 429 | **24 × 204, then 1 × 429 (`Retry-After: 1`)** |

The 24-write threshold is the two-replica signature reported in prior
verification and proves the deployed product is not one shared transactional
desk. It defeats the required per-client allowance and may split bookings,
owner settings, and cleanup state between replicas. Hold production to exactly
one serving replica with its persistent volume, or use a shared transactional
database/rate limiter. Then repeat cache-busted read and write bursts until
each has exactly the documented allowance followed by `429 Retry-After: 1`.

### P1 — cold landing page fails the plain-words acceptance gate

A new no-storage browser opened the live root cold. Its only H1 is:

> “Release dates, finalized 8 weeks out.”

The supporting line says only that “We open the appointment calendar 8 weeks
in advance and lock dates two weeks before the event.” Neither identifies the
actual job (guest requests, owner approval, and guest confirmation) nor names
the intended microbusiness user. It presents an unexplained release board
instead of the researched product. The first-visible `Try it with sample data`
link works and opens `/demo`, but that does not cure the required answer to
what it does and for whom. This fails the explicit cold first-read contract.

## Mandatory claims — PASS (20/20)

From the clean candidate checkout, after `npm ci` (85 packages; audit: 0
vulnerabilities), I first invoked every command in `.factory/claims.json`
individually through its configured demo/server entry point. All passed:

- 13 Playwright claim commands: demo confirmation, eight-week board,
  local-only demo, cookies, guest/no-account approval, reschedule, cancellation,
  ICS, manual reminder, browser license storage, read limit, and Entra owner
  identity.
- 6 locked Rust claim tests: anonymous page views, free/pro capacity and
  retention, revoked-license fallback, artwork provenance, and container
  runtime contract.
- `npm run test:billing`: live Sociobot hosted Panel Pro checkout, exact USD
  29.00, passed without a purchase.

The locally tested API limiter claim therefore passes only against one fresh
local server; it does not prove the production topology.

## Local checks — PASS

- `npm test`: 4 Vitest, 20 Rust, claims-registry contract, and 4 deployment
  contract tests passed.
- `npm run check`: `tsc --noEmit` and `cargo clippy -- -D warnings` passed.
- `cargo fmt --all -- --check` passed.
- `npm run build` produced `dist/`. Initial main JS is 48,873 bytes raw /
  15.00 KB gzip; initial CSS is 36,545 bytes raw / 8.36 KB gzip. The 260,119
  byte owner-auth chunk is lazy-loaded (65.99 KB gzip).
- `npm run test:e2e`: 22/22 passed; Playwright's final status is `passed`.
- The server started with only `PORT=4180` in its environment, used its `/data`
  SQLite default, exposed `/health`, and logged graceful SIGTERM shutdown.
- Docker is not installed in this verifier container, so an actual image build
  could not be performed. The locked release build and container contract test
  passed.

## Live checks — PASS except the P1 above

- `/health` returned `200` with build SHA
  `23cb8cc4f991ef2d01a02f3f3b9bea4fb135f069`.
- Root has CSP with response-header `frame-ancestors 'none'`, `nosniff`,
  `X-Frame-Options: DENY`, same-origin referrer policy, and a denied
  camera/microphone/geolocation permissions policy. HTML is `no-cache`; the
  hashed main JS is `public, max-age=31536000, immutable`.
- The factory `verify-url.sh` passed: title, `lang=en`, one H1, main landmark,
  image alts, and no console errors. Evidence is in
  `.factory/verification-artifacts/12/`.
- Live axe 4.10.2 found zero serious or critical issues on the landing page and
  `/demo` at desktop and 390 px. Keyboard Tab reaches the skip link and Enter
  moves focus to main; no mobile horizontal overflow was observed. Reduced
  motion changes scroll behavior to `auto`.
- The live demo confirms the realistic Maya Chen/Northstar Barber booking,
  has the persistent “Demo — sample data, nothing is saved” banner with Reset
  demo and Start for real, stores only
  `demo:guest-booking-confirm:state`, sends no request during confirmation,
  and sets no cookie. Cold landing requests were all same-origin.
- Service worker control and offline `/demo` reload passed; `/auth/callback`
  was not cached. `/privacy`, `/terms`, `/manage`, `robots.txt`, and
  `sitemap.xml` returned 200; an unknown route returned its designed 404.
- Owner sign-in offers no password input and made its sole external request to
  `https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/`.
  Unauthenticated owner status returns 401.
- An independent Lighthouse CLI attempt could not complete because Chromium
  crashed in this container. Bundle, caching, browser-console, axe, and mobile
  checks above completed successfully; no Lighthouse score is claimed here.

## Defects by severity

- **P1:** Live deployment lets a single client exceed 40 reads and 12 writes;
  fresh evidence shows a two-replica, split-state signature.
- **P1:** Landing page fails the mandatory plain-words first-read contract and
  no longer represents Guest Booking Confirm's researched job-to-be-done.

No product code was modified by this verification.
