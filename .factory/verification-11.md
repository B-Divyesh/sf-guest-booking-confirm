# Guest Booking Confirm — independent verification: **FAIL**

Date: 2026-08-29

Work order: `guest-booking-confirm-verify-11`

Candidate and live build: `c91a921ed8f6c7f3dd77db42d46bb9491775e6c6`

Live URL: <https://guest-booking-confirm.sociobot.in>

Contract: `.factory/brief.json`, the original work order, and the attached
factory skills.

## Decision

**FAIL — do not release.** The deployed `/health` endpoint identifies the
candidate exactly, and local source quality gates, the demo, core workflows,
and accessibility checks pass. Fresh live traffic nevertheless proves that
the backend does not consistently enforce its documented per-client allowance.
That is a P1 deployment blocker for this SQLite-backed product.

## P1 — live limiter and single-replica contract are not enforced

Source (`src/main.rs`) sets a rolling one-second limit of 40 GETs and 12
writes per client, with `429` and `Retry-After: 1` after the limit. The README
publishes the 40-read allowance. Fresh requests to the live candidate, each
using a new `X-Forwarded-For` identity, produced:

| Live burst | Result |
| --- | --- |
| 45 `GET /api/public/settings` | 40 × 200, 5 × 429; every 429 had `Retry-After: 1` |
| five independent 41-read bursts | **41 × 200 each; no 429** |
| 13 `POST /api/page-view` | 13 × 204; no 429 |
| 45 `POST /api/page-view` | **24 × 204, 21 × 429**; every 429 had `Retry-After: 1` |

The repeatable 41-read and 24-write successes are respectively over the
documented/source allowances of 40 and 12. The 24-write threshold is the
signature of two independently limited replicas with replica-local SQLite
state. It also risks booking persistence being split between replicas. This
reproduces verification-10's deployment-only failure despite the candidate's
checked-in repair/deployment contract tests and despite the live build SHA
being current.

Required correction: hold traffic to one serving replica (`minReplicas=1`,
`maxReplicas=1`, single revision), or move booking and rate-limit state to a
shared transactional store. Then repeat multiple cache-busted read and write
bursts and require exactly 40/12 successes followed by `429` plus
`Retry-After: 1`.

## Cold first-read and demo gate — PASS

A new desktop browser opened the live root cold with no cookies or storage.
The first screen says what it does: “Request and confirm guest appointments”; 
who it is for: “small businesses that approve times before guests book”; and
what to do first: “Try it with sample data,” with adjacent copy explaining the
sample request → approval → confirmation flow. The action opens `/demo` in one
click. The 390 px demo has a persistent “Demo — sample data, nothing is
saved” banner, Reset demo, and Start for real controls.

Observed demo state was realistic (Maya Chen, Northstar Barber, 45 minutes,
EDT) and stored only as `demo:guest-booking-confirm:state`. Guest confirmation,
reschedule request, cancellation, manual reminder record/undo, and a
downloadable `demo-booking.ics` with `VCALENDAR`, `DTSTART`, `DTEND`, summary,
and `STATUS:CONFIRMED` worked. Demo requests stayed same-origin and no cookie
was set.

## Mandatory claims — PASS after clean dependency install (19/19)

`.factory/claims.json` exists and defines 19 claims. As required, the listed
commands were first invoked from the untouched clone; browser commands could
not resolve `@playwright/test` before `npm ci` (normal absent-dependency state,
recorded here for reproducibility). After the clean `npm ci` install, every
listed command was invoked individually. The 12 Playwright claim commands,
the 6 locked Rust claim commands, and `npm run test:billing` passed. The
billing test confirmed the live USD 29.00 Sociobot/Dodo hosted checkout without
purchase.

`npm test` also passed: 4 Vitest, 20 Rust (including concurrency, validation,
retention, Entra, and rate-counter tests), 1 claims-registry contract, and 2
deployment-contract tests.

## Local quality gates — PASS

- `npm ci`: 85 packages installed; audit reported 0 vulnerabilities.
- `npm test`: PASS.
- `npm run check`: TypeScript and `cargo clippy -D warnings` PASS.
- `cargo fmt --all -- --check`: PASS.
- `cargo build --release --locked`: PASS; release binary is 14 MB.
- `npm run build`: PASS; `dist/` produced. Main initial JS is 42,459 bytes
  raw / 13,100 bytes gzip; CSS is 20,482 / 5,340 bytes gzip. The 260,119-byte
  owner-auth chunk is lazy-loaded (65,990 bytes gzip).
- `npm run test:e2e`: second complete run PASS, 22/22. The first full run had
  one transient mobile guest-flow failure (owner setup remained on its form);
  the exact affected claim passed immediately on rerun, followed by the clean
  22/22 run. Treat this as P2 test flakiness to investigate, not the release
  decision.
- Docker is not installed in this verifier container, so an image build could
  not be run locally. The locked release build and shipped Docker contract test
  passed.

## Live deployment, privacy, accessibility, and performance checks — PASS

- `/health` returned `200` and exactly the candidate SHA. Root response has
  CSP with header-only `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  `nosniff`, same-origin referrer policy, and denied camera/microphone/location.
- The root shell is `no-cache`; hashed JS is one-year immutable. `robots.txt`
  and `sitemap.xml` return 200; an unknown route returns 404.
- Browser request logging over the live demo flow found only same-origin
  requests, no booking API action request, no third-party analytics, and no
  cookies. `sessionStorage` was empty in demo mode.
- Axe 4.10.2 at 390 px found zero serious or critical violations on `/`,
  `/demo`, `/privacy`, and `/terms`. Visual inspection at 390 px found readable
  copy, ≥44 px primary controls, visible focus treatment, and no overlap. The
  documented mid-century signal-desk visual system is present and distinct.
- The full Playwright suite covers desktop/mobile keyboard operation, visible
  focus, 200% text, reduced motion, PWA update/offline reload, Entra-only owner
  identity, and API error/recovery paths.

## Defects by severity

- **P1:** Live backend intermittently permits 41 reads and consistently permits
  24 writes per client in one second; likely multiple replicas with local
  SQLite limiter/booking state. Release-blocking.
- **P2:** One of two complete local `npm run test:e2e` runs flaked in the mobile
  guest-flow setup stage. Exact claim and immediate complete retry passed.

No P0 issue was found. No product code was modified during verification.
