# Guest Booking Confirm — independent verification: **FAIL**

Date: 2026-08-29

Work order: `guest-booking-confirm-verify-10`

Candidate: `bacb76f118db1a65945eb83b67437a7f703cf19a`

Live URL: <https://guest-booking-confirm.sociobot.in>

Contract: `.factory/brief.json`, the original work order, and attached factory skills

## Decision

**FAIL — do not release this deployment.** Candidate source, all mandatory
claims, core booking behavior, accessibility, privacy checks, build, and
deployed file identity pass. Fresh live evidence found one P1 blocker: the
deployed service does not enforce its documented per-client request allowance.

There are no P0 findings and no other P1 findings.

## P1 release blocker — live allowance is doubled

The public contract allows 40 reads and 12 writes per client in a rolling
second; later requests must return `429` with `Retry-After: 1`. The candidate
does this locally, including for `/api/license/verify`. Live does not:

- Three independent cache-busted 41-read bursts each returned **41 × 200**.
- Three independent 13-write bursts each returned **13 × 204**.
- A 387 ms burst returned **80 × 200 + 20 × 429** reads.
- An 85 ms burst returned **24 × 204 + 16 × 429** writes.
- Thirteen live `/api/license/verify` calls from one client returned **13 ×
  401**, with no 429. Locally, an authenticated invalid-license burst returns
  **12 × 422 + 1 × 429**, with `Retry-After: 1`.

The exact 80/24 thresholds are twice the source limits and are consistent with
two independently limited replicas. That violates the checked-in
one-serving-replica SQLite contract, doubles the public allowance, and risks
splitting booking state across replica-local databases.

This is not a stale build: live `/health` returns the candidate SHA and every
local `dist/` file matches the deployed file by SHA-256.

Evidence: `live-rate-limit-three-repetitions.json`,
`live-rate-limit-repeat.json`, `backend-audit.json`, and
`deployment/hash-parity.tsv` under `.factory/verification-artifacts/`.

Required correction: enforce `minReplicas=1` and `maxReplicas=1`, then prove
repeated live 41/13 bursts return 40/12 successes followed by 429. If multiple
replicas are intentional, use shared transactional booking and limiter state.

## Cold first-read gate — PASS

The fresh 1440 × 900 first viewport says:

- What: **“Request and confirm guest appointments.”**
- For whom: **“For small businesses that approve times before guests book.”**
- First action: **“Try it with sample data.”** Adjacent copy explains the
  request → approval → confirmation outcome and that nothing is saved.

The one-click action opens `/demo` with Maya Chen's approved appointment and a
persistent “Demo — sample data, nothing is saved” banner. Cold cookies and
storage were empty. Evidence: `live-first-read-desktop.png`.

## Mandatory claims — PASS (19/19)

`.factory/claims.json` exists. After `npm ci`, every command was run
individually and exactly as listed from candidate `HEAD`.

| Claim | Result |
| --- | --- |
| `demo-confirmation-trail` | PASS — 1/1 Playwright, including clean cold Rust compile |
| `demo-local-only` | PASS — 1/1 Playwright |
| `no-tracking-cookies` | PASS — 1/1 Playwright |
| `anonymous-page-view-count` | PASS — 1/1 locked Rust |
| `guest-no-account` | PASS — 1/1 Playwright |
| `owner-approval-before-booking` | PASS — 1/1 Playwright |
| `guest-rescheduling` | PASS — 1/1 Playwright |
| `guest-cancellation` | PASS — 1/1 Playwright |
| `confirmed-calendar-ics` | PASS — 1/1 Playwright |
| `manual-reminder-checklist` | PASS — 1/1 Playwright |
| `free-desk-capacity-and-retention` | PASS — 1/1 locked Rust |
| `panel-pro-capacity-and-retention` | PASS — 1/1 locked Rust |
| `panel-pro-checkout` | PASS — live USD 29 catalog, 303 checkout, Dodo page; no purchase |
| `browser-license-storage` | PASS — 1/1 Playwright |
| `revoked-license-fallback` | PASS — 1/1 locked Rust |
| `generated-artwork-provenance` | PASS — 1/1 locked Rust |
| `api-rate-limit` | PASS locally; deployment failure documented above |
| `owner-entra-identity` | PASS — 1/1 Playwright |
| `container-runtime-contract` | PASS — 1/1 locked Rust |

Per-claim logs and the zero-exit summary are in
`.factory/verification-artifacts/claims/`.

## Clean local gates

- `npm ci` — PASS; 85 packages installed, 86 audited, 0 vulnerabilities.
- `npm test` — PASS: 4 Vitest, 20 Rust, 1 claim-registry contract.
- `npm run check` — PASS: TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check` — PASS.
- `cargo build --release --locked` — PASS.
- `npm run build` — PASS; exact production `dist/` produced.
- `npm audit --omit=dev` — PASS: 0 vulnerabilities.
- `npm run test:e2e` — PASS: 22/22 Playwright tests.

Logs: `.factory/verification-artifacts/gates/`. Docker/Podman are unavailable in
this container; the locked release binary, Docker contract test, PORT-only
runtime, and exact deployed files were checked instead.

## Independent product exercise

A release binary used a new SQLite database outside repository tests.

- Owner setup: 201; unauthenticated owner access: 401.
- Invalid hours were explained and recovered after correction.
- Empty owner queue, loading, deliberate offline error, and Retry recovery all
  gave a next step.
- Missing fields and invalid email produced an announced recovery message.
- Invalid name, email, consent, past time, and private token returned 422/404
  with corrective text.
- Request → approval → confirmation worked. Two concurrent confirmations
  produced exactly one 200 and one 409.
- Two same-slot requests could await review; concurrent approval produced one
  200 and one 409.
- ICS was a 200 calendar attachment with `VCALENDAR`, summary, start/end, and
  `STATUS:CONFIRMED`.
- The real UI completed rescheduling, reapproval, manual reminder, keyboard
  confirmation, and cancellation.
- Confirmed state survived SIGTERM and restart on the same database.
- 100 local reads with distinct identities returned 100 × 200 in 170 ms (p95
  109 ms).
- The release binary started with only `PORT=4188`, defaulted to
  `sqlite:/data/guest-booking-confirm.db`, logged the required Entra authority,
  served health, and stopped gracefully.

Fresh `America/New_York` DST checks omitted nonexistent 02:00/02:30 slots on
2027-03-14 and ambiguous 01:00/01:30 slots on 2026-11-01, with correct offsets.

Evidence: `backend-audit.json`, `backend-persistence.json`,
`local-ui-audit.json`, `dst-audit.json`, and `port-only.log`.

## Deployment, privacy, and security

- Live `/health`: `bacb76f118db1a65945eb83b67437a7f703cf19a`.
- SHA-256 matches for `index.html` and every JS, CSS, image, icon, service
  worker, sitemap, robots, and 404 asset.
- A full live demo flow emitted only same-origin GETs, no `/api` action request,
  no cross-origin request, and no cookie.
- Demo storage held only `demo:guest-booking-confirm:state`; session storage
  stayed empty.
- Cold landing traffic was same-origin. The configured page-view call was a
  same-origin POST; its registered test proved a day/count-only schema.
- Responses send CSP with header-only `frame-ancestors 'none'`, DENY framing,
  nosniff, same-origin referrer policy, and denied camera/microphone/location.
- Shell and `/sw.js` are `no-cache`; hashed assets are one-year immutable.
- Unknown routes return the designed 404 HTML. All rendered internal links,
  `robots.txt`, and `sitemap.xml` returned expected status.
- Owner access has no password and contacts only
  `sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650`.
  Identity state stays in session storage.

## Accessibility, mobile, PWA, visual, and performance

- Factory `verify-url.sh` — PASS on live `/` and `/demo`; no console errors.
- Axe 4.10.2 — zero serious/critical findings on `/`, `/demo`, `/privacy`,
  `/terms`, `/manage` at 1440 × 900 and 390 × 844.
- Every route had `lang=en`, one `h1`, one `main`, alt text, no horizontal
  overflow, and no undersized visible interactive control.
- All five routes had no horizontal overflow at 200% text on 390 px.
- Keyboard skip, demo controls, Space/Enter, and back-navigation focus passed.
- Dark focus outlines are 3 px and 5.54:1 against the demo banner.
- Reduced motion used `scroll-behavior: auto` and left no measured animation or
  transition longer than 0.01 ms.
- Service-worker update passed, `/auth/callback` was not cached, and confirmed
  demo state survived offline reload.
- Visual review found clear hierarchy, legible states, non-overlapping mobile
  controls, and the documented signal-desk identity.
- Lighthouse mobile: **98 performance / 100 accessibility / 100 best practices
  / 100 SEO**; FCP 1.2 s, LCP 1.5 s, TBT 140 ms, CLS 0.
- Main/helper JS: 42,459 + 711 bytes raw (13,064 + 420 gzip). CSS: 20,482 raw
  / 5,355 gzip. Hero WebP: 41,526 bytes. The 65,679-byte gzip owner auth chunk
  is lazy-loaded. Budgets pass.

Evidence: `live-browser-audit.json`, `verify-url-*`, and
`lighthouse-live.json` under `.factory/verification-artifacts/`.

## Release condition

Keep the deployment blocked until it uses one serving replica or shared
transactional state, and repeated live read, write, and license-route bursts
prove 40/12 allowances with immediate `429` plus `Retry-After: 1`.
