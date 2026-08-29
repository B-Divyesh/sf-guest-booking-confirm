# Guest Booking Confirm — independent verification 6: **FAIL**

Date: 2026-08-29

Candidate: `7aa1a7ebefabfb0adf485103487367676f916c6b`

Live: <https://guest-booking-confirm.sociobot.in>

**FAIL — do not release.** Fresh `/health` and byte-for-byte asset hashes prove the live deployment matches the candidate. All 12 registered claim commands, clean install, unit/Rust tests, strict checks, production/release builds, all 16 Playwright tests, privacy/PWA checks, axe scans, Lighthouse budgets, and the documented live 40-GET rate allowance passed.

Release blockers found independently:

- The claimed free limit is raceable: from 29 active bookings, 12 concurrent distinct-client requests returned three `201`s and left **32 active bookings**. The count and insert in `src/main.rs` are not atomic.
- The owner panel uses a local Argon2 password and its own **Sign in** flow, not the required Sociobot Entra External ID authority `sociobotcustomers.ciamlogin.com`.
- At 390 px, every owner-setup closing-time input is an unreadable **18 × 44 px** strip. The real setup flow is not mobile-usable and violates the 44 × 44 target baseline.
- The claims contract still omits the README/privacy “unguessable private link” and container-runtime promises. The manual-reminder claim test also does not observe the promised absence of message/network sending.

Additional defects: the landing action note overlaps its button by 14 px at desktop and mobile, the demo reaches 436 px width at 200% text on a 390 px viewport, and the API counts UTF-8 bytes while describing a 2–80-character name rule.

Complete evidence, exact commands, results, screenshots, and repair requirements: `.factory/verification-6.md` and `.factory/qa-artifacts/verification-6/`. No product code was changed.

---

# Guest Booking Confirm — repair 4: **DEPLOYED**

Date: 2026-08-29
Work order: `guest-booking-confirm-repair-4`
Verifier report repaired: `.factory/verification-5.md` against candidate `abe9681e0372c259b60f8382d3f72898e816c090`
Repaired and deployed candidate: `ab40ce2ec9b4e9bad5976a0283ad022ad34e0d87`

## Release-blocking repairs

- Registered the four previously unlisted visitor claims in `.factory/claims.json`: private-link rescheduling, private-link cancellation, confirmed ICS download, and the manual reminder checklist. Each has exactly one tagged command and a clean `/demo` browser sandbox assertion.
- Extended the isolated demo without touching the real desk: Maya Chen's sample now demonstrates a request for another time, cancellation, an ICS download with appointment fields, and an owner-only manual-reminder record. Its sole persisted value remains `demo:guest-booking-confirm:state`; it never calls a booking API.
- Added the backend regression `real_booking_actions_reschedule_calendar_reminder_and_cancel`, which exercises the production handlers through reschedule → owner reapproval → confirmation → ICS headers/body → owner reminder → cancellation.
- Restored the persistent demo controls above the mandatory minimum by changing their explicit override from 36px to 48px. The new 390px regression checks both controls' width and height; live measurement is Reset demo **117.8125 × 48** CSS px and Start for real **109.71875 × 48** CSS px.
- Added a keyboard regression for Tab, Space, and Enter on the persistent demo controls, and extended legal-page axe coverage.

## Verification evidence

Clean checkout and local quality gates:

- `npm ci` — PASS; 0 vulnerabilities.
- Every one of the 12 commands in `.factory/claims.json` — PASS. The four new commands are `@claim:guest-rescheduling`, `@claim:guest-cancellation`, `@claim:confirmed-calendar-ics`, and `@claim:manual-reminder-checklist`.
- `npm test` — PASS: 4 Vitest tests and 11 locked Rust tests, including the new real booking-action regression.
- `npm run check` — PASS: strict TypeScript and `cargo clippy -- -D warnings`.
- `npm run build` — PASS; `dist/` produced. Main JS is 40.63 kB raw / 12.32 kB gzip, companion JS 0.71 kB raw / 0.40 kB gzip, and CSS 20.19 kB raw / 5.28 kB gzip.
- `npm run test:e2e` — PASS: 16 Playwright tests. They cover 390px targets, keyboard operation, all demo claims, real guest request → owner approval → confirmation, accessibility on demo/legal pages, 404, immutable assets, and offline reload.
- `cargo build --release --locked` — PASS. The release binary started with `env -i PORT=4183` only, selected the default `/data/guest-booking-confirm.db`, logged its generated/default configuration without values, and returned `{"build_sha":"dev","status":"ok"}` locally.
- `npm audit --omit=dev` — PASS; 0 vulnerabilities. This is a web-with-backend product, not a package, so no package-consumer check applies.
- Local `verify-url.sh` evidence is in `.factory/qa-artifacts/repair-4-local/verify.json`: one title/lang/h1/main, all images have alt text, and no console errors. Lighthouse mobile on `/demo` was Performance **98**, Accessibility **100**, LCP **1.8 s**, CLS **0**.

Live candidate evidence:

- `GET https://guest-booking-confirm.sociobot.in/health` returned the exact deployed SHA: `{"build_sha":"ab40ce2ec9b4e9bad5976a0283ad022ad34e0d87","status":"ok"}`.
- Fresh desktop `/demo`: no console/page errors, zero axe serious/critical findings, only same-origin requests, no cookies, and only `demo:guest-booking-confirm:state` in local storage. The downloaded sample calendar is `demo-booking.ics` and contains `VCALENDAR`, the Northstar Barber summary, and `STATUS:CONFIRMED`.
- Fresh 390×844 `/demo`: no horizontal overflow (390 = 390), zero axe serious/critical findings, and both persistent targets measure 48px high. The live sample reaches **New time requested**, **Cancelled**, and the persisted **Sample reminder recorded** state.
- Keyboard regression passes Tab reachability plus Space on Reset demo and Enter on Start for real. Reduced motion reports `scroll-behavior: auto` and a `0.00001s` transition duration.
- Service-worker update/offline test passed: the live demo is controlled, active worker is `activated`, no worker is waiting/installing after `registration.update()`, and an offline reload shows **Ready to confirm**.
- Response policy passed: HTML has `nosniff`, `DENY` framing, `same-origin` referrer policy, restrictive response-header CSP including `frame-ancestors 'none'`, and `Cache-Control: no-cache`; hashed JS is `public, max-age=31536000, immutable`; an unknown route is real HTTP 404.
- Live rate-limit check passed: 40 `200` responses followed by one `429` with `Retry-After: 1` for one forwarded client IP.
- Live `verify-url.sh` evidence is retained in `.factory/qa-artifacts/repair-4-live/verify.json` with screenshots.

## Factory container deployment

- Factory ACR build run `chyx` succeeded in 5m01s, producing `sociobotregistry.azurecr.io/sf-guest-booking-confirm:ab40ce2ec9b4` with digest `sha256:3c9f31a34dfd70e39d4bc87f5e4153611d6b24d48ad7390146b3aa1fdf994227`.
- Azure Container Apps revision `sf-guest-booking-confirm--0000007` is provisioned successfully with that image and only `PORT=8080` configured.

## Run and verify

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
cargo build --release --locked
docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t guest-booking-confirm .
docker run --rm -p 8080:8080 -v gbc-data:/data guest-booking-confirm
```

No known product gaps remain from verification 5.

---

# Guest Booking Confirm — independent verification 5: **FAIL**

Date: 2026-08-29
Verified candidate: `abe9681e0372c259b60f8382d3f72898e816c090`
Live URL: <https://guest-booking-confirm.sociobot.in>

**FAIL — release blocked.** Fresh `/health` identifies the live deployment as the exact candidate SHA, so the prior deployment-only failure is repaired. All eight registered claim commands, clean install, tests, checks, build, release build, live browser/privacy/PWA checks, and the 40-GET API allowance check passed.

Two blocking contract defects remain:

- **P1:** `README.md:3` claims rescheduling, cancellation, ICS calendar download, and the manual reminder checklist, but `.factory/claims.json` has no corresponding individually tagged demo-sandbox claim tests. The mandatory claims contract requires every visitor-reliant claim to be registered and tested; the full evidence is in `.factory/verification-5.md`.
- **P2:** The persistent `/demo` controls are below the mandatory 44×44 CSS-pixel target on desktop and 390px mobile: Reset demo is 117.81×43.81 and Start for real is 109.72×36. `frontend/src/styles.css:67` explicitly overrides the global 44px minimum with 36px banner controls.

Do not release this candidate until both issues are repaired and independently verified. No product code was changed by this verification.

---

# Guest Booking Confirm — repair 3: **DEPLOYED**

Date: 2026-08-28
Work order: `guest-booking-confirm-repair-3`
Verifier report repaired: `.factory/verification-4.md` against candidate `04da75a04ebe6815e8816b01c8f9fca16d32f3ea`
Repaired source commit: `e3da7718d143fa163dee368d2e897c188b4a0c87`

## Release-blocking repair

- Reproduced the verifier failure before changing source: `Dockerfile:8` declared `FROM rust:1.88-bookworm AS backend`, a prohibited minor-pinned Rust builder.
- Replaced it with the mandated unpinned current-stable builder: `FROM rust:1-slim AS backend`. The existing multi-stage build, default `ARG BUILD_SHA=dev`, non-root Debian runtime, `PORT=8080`, and `/health` build identity are unchanged.
- Added `tests::dockerfile_uses_the_unpinned_current_stable_rust_builder` to the Rust unit suite. It requires the builder line to be exactly `FROM rust:1-slim AS backend` and rejects a `rust:1.<minor>` tag, so this exact release blocker cannot regress unnoticed.

## Verification evidence

Clean install and local quality gates:

- `npm ci` — PASS; 84 packages audited, 0 vulnerabilities.
- `cargo test --locked dockerfile_uses_the_unpinned_current_stable_rust_builder` — PASS (the new targeted regression).
- `npm test` — PASS; 4 Vitest + 10 Rust tests, including both booking concurrency tests, capacity/retention claims, invalid-hours recovery, and the Dockerfile regression.
- `npm run check` — PASS; strict TypeScript plus `cargo clippy -- -D warnings`.
- `npm run build` — PASS; `dist/` produced. Initial JavaScript is 36.99 kB raw / 11.61 kB gzip; CSS is 19.92 kB raw / 5.23 kB gzip.
- `cargo build --release --locked` — PASS.
- `npm run test:e2e` — PASS; 10 Playwright tests covering 390px booking flow, desktop 404/immutable asset check, keyboard-accessible error recovery, axe, privacy, claim flows, and service-worker-controlled offline demo reload.
- `npm audit --omit=dev` — PASS; 0 vulnerabilities. This is a web-with-backend product, not a distributable library; no package-consumer check applies.

Release-binary and live checks:

- A fresh local release binary on a temporary SQLite desk passed desktop and 390px smoke checks: zero serious/critical axe findings, no horizontal overflow at 200% text, and the keyboard trail had a designed `3px solid rgb(20, 109, 135)` focus ring on every reached control.
- Live desktop and 390px Chromium checks at `https://guest-booking-confirm.sociobot.in` passed: landing h1 is **Request and confirm guest appointments**, no console/page errors, no horizontal overflow, zero serious/critical axe findings, and all recorded requests were same-origin. Reduced-motion reported `scroll-behavior: auto` and `transition-duration: 0.01ms`.
- Live demo privacy/offline/update check passed: after confirming sample data, cookies were empty, localStorage contained only `demo:guest-booking-confirm:state`, and requests stayed same-origin. With service-worker control, `registration.update()` reported active `activated` and no waiting worker; `/demo` reloaded offline with **Ready to confirm**.
- Live response policy passed: HTML served `nosniff`, `DENY` framing, `same-origin` referrer policy, the restrictive CSP, and `Cache-Control: no-cache`; hashed `main-aAVthVdE.js` served `public, max-age=31536000, immutable`.
- Live rate-limit check passed: 41 concurrent `GET /api/public/settings` requests from one fresh forwarded IP returned 40 × `200` and 1 × `429` with `Retry-After: 1`.
- Live identity passed: `GET /health` returned `{"build_sha":"e3da7718d143fa163dee368d2e897c188b4a0c87","status":"ok"}`.

## Factory build and deployment

- Factory ACR run `chme` passed in 5m08s. The upload log confirms `.git` was excluded. It built `sociobotregistry.azurecr.io/sf-guest-booking-confirm:e3da7718d143` with image digest `sha256:279f5f0ab6ce4a3d2f4ab700f1a282c7f127c6b614d549c502b7f37b186fb48f`.
- The ACR dependency record explicitly reports build-time dependency `library/rust:1-slim` (digest `sha256:17d1ba895198f9934c6314ec5346a0d5115372f3243390c3d731e242f35c2f27`), proving the required unpinned base image was used.
- Deployed to Azure Container Apps revision `sf-guest-booking-confirm--repair3`, single-revision mode, 100% latest traffic, with the verified image and only `PORT=8080` configured.

## Run and verify

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
cargo build --release --locked
docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t guest-booking-confirm .
docker run --rm -p 8080:8080 -v gbc-data:/data guest-booking-confirm
```

The worker environment has no local Docker daemon; the exact container verification was therefore performed by the successful factory ACR build above. No known product gaps remain from verification 4.

---

# Guest Booking Confirm — independent verification 4: **FAIL (historical; repaired above)**

Date: 2026-08-28
Verified candidate: `04da75a04ebe6815e8816b01c8f9fca16d32f3ea`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Verification outcome

**FAIL — release blocked.** Fresh live `/health` identifies the deployment as the exact candidate SHA. The claim registry, all local test/build/type checks, release binary startup, full Playwright suite, live mobile/desktop demo, privacy request log, axe scan, response headers, offline reload, and rate-limit check passed. The complete evidence is in `.factory/verification-4.md`.

### P1 release-blocking defect

`Dockerfile:8` pins `FROM rust:1.88-bookworm AS backend`. The mandatory backend Dockerfile contract requires current stable `rust:1-slim` or `rust:1-alpine` and expressly forbids minor pinning. This can break the factory's future ACR production build when lockfile dependencies require a newer Rust compiler. Use a permitted unpinned current-stable Rust base, verify an ACR/factory Docker build, redeploy, then rerun verification.

The verifier environment has no Docker executable, so it could not execute the exact Docker command locally. That limitation is not the failure basis; the contract violation is directly visible in committed source. No product code was modified by this verification.

---

# Guest Booking Confirm — repair handoff: **READY FOR DEPLOYMENT**

Date: 2026-08-28
Work order: `guest-booking-confirm-repair-2`
Verifier report repaired: `.factory/verification-3.md` against candidate `935265f70b2055860153c03b17f08bc04ec9c27f`

## Fixed release blockers

- Guest confirmation now uses a conditional SQLite update. Concurrent uses of one private link yield exactly one `200` and one `409`; the row ends `confirmed`.
- Guest cancellation and rescheduling also compare the state read from the private link when writing, so parallel use cannot silently overwrite a just-completed guest action.
- Owner approval is now a single conditional update that checks for an existing accepted booking inside the write. Parallel owner approvals for the same slot leave exactly one held booking.
- Setup and settings now reject malformed, out-of-range, inverted, and too-short weekly intervals with `422`. The owner form performs the same check before it sends, with the direct recovery message “Monday closing time must be later than opening time.”
- Completed the claims registry for no-account guests, owner approval, free and paid capacity/retention, and rate limiting, with exact runnable regression commands.
- Corrected the paid-plan mobile contrast failure and expanded practical navigation, owner-action, and footer tap targets to 44px.

## Exact verification evidence

Clean install: `npm ci` completed with 0 vulnerabilities.

- `npm test` — PASS: 4 Vitest and 9 Rust tests.
- `npm run check` — PASS: strict TypeScript and `cargo clippy -- -D warnings`.
- `npm run build` — PASS: `dist/`; initial main JS 36.99 kB raw / 11.61 kB gzip, CSS 19.85 kB raw / 5.23 kB gzip.
- `npm run test:e2e` — PASS: 10 Playwright checks, including desktop routing and 390px mobile guest workflow, invalid-hours recovery, demo/offline, privacy, claims, and axe serious/critical scan.
- `cargo build --release --locked` — PASS.
- `npm audit --omit=dev` — PASS: 0 vulnerabilities.
- Every command recorded in `.factory/claims.json` was run from a clean Playwright/Rust test server and passed.

Runtime evidence on a fresh SQLite desk at `http://127.0.0.1:4180` is retained in `.factory/qa-artifacts/`:

- `backend-concurrency.json`: one accepted booking for 12 simultaneous owner approvals; guest confirm `200, 409`; guest cancel `200, 409`; confirmed ICS is downloadable.
- `backend-state-flow.json`: reschedule `200, 409`, owner approval, confirmation, reminder, completion all succeed in order.
- `axe-owner.json` and `local-browser-audit.json`: zero serious/critical axe findings on desktop and 390px owner views; no mobile horizontal overflow. `keyboard-resize-audit.json` records the designed 3px focus ring and no overflow at 200% text.
- The full browser suite verifies service-worker-controlled offline `/demo` reload and no demo API request, cookies, or third-party request.

## Run and deploy

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
cargo build --release --locked
docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t guest-booking-confirm .
docker run --rm -p 8080:8080 -v gbc-data:/data guest-booking-confirm
```

The container needs only `PORT` (default `8080`) and persists SQLite under `/data`. It runs as non-root. The factory deployment is an Azure Container Apps container build using `BUILD_SHA`; deployment identity must be verified at `/health` after rollout.

## Deployment evidence

- ACR run `chkb` succeeded from the final runtime source commit `07b9d31a44b71c47ff4a1b35d56e290d64784be3`; the upload log confirms `.git` was excluded.
- Azure Container App revision `sf-guest-booking-confirm--0000004` is provisioned with `sociobotregistry.azurecr.io/sf-guest-booking-confirm:07b9d31a44b7` and retains only `PORT=8080`.
- Live `https://guest-booking-confirm.sociobot.in/health` returns `{"build_sha":"07b9d31a44b71c47ff4a1b35d56e290d64784be3","status":"ok"}`.
- Live Chromium smoke at 1440px and 390px found the correct landing h1, no console errors, no horizontal overflow, and a 44px-high owner-setup link. The public response still carries the expected CSP, nosniff, frame denial, and same-origin referrer policy headers.

## Known gaps

The local worker image has no Docker executable, so the Docker build is delegated to the factory ACR build. All equivalent frontend production, locked Rust release, runtime, and browser checks passed locally.

---

# Guest Booking Confirm — repair handoff

Date: 2026-08-28  
Work order: `guest-booking-confirm-repair-1`  
Repaired source commit: `fad50366bf307eeeb5bc6cdd21d19a34b8e9d709`

## Release-blocking repair

This repair addresses every finding in independent report `verification-1.md` against candidate `57dab139c961a5ad93a1a224155b4ae6d5c11a76`.

- Added `/demo`, a one-click guest-confirmation sandbox seeded with Maya Chen's approved Northstar Barber appointment. Its only state is `localStorage` key `demo:guest-booking-confirm:state`; it never reads or writes the owner SQLite database and makes no booking API request. The persistent banner includes **Reset demo** and **Start for real**.
- Reworked the cold, unconfigured landing state around the guest job: **Request and confirm guest appointments**, who it is for, a primary **Try it with sample data** action, and three plain facts. The configured guest page also exposes the sample action.
- Added the required claims contract, demo documentation, and plain-language copy audit. Every listed claim has a clean-browser `/demo` Playwright test.
- Added title/canonical/Open Graph/Twitter metadata, original 1200×630 social artwork derivative and 180px touch icon, `robots.txt`, `sitemap.xml`, a `staticwebapp.config.json`, designed status-404 page, and server routes that return an actual HTTP 404 rather than an SPA-shell 200.
- Added `Cache-Control: public, max-age=31536000, immutable` for `/assets/*` and `no-cache` for HTML/service-worker entry points while preserving the existing CSP and security headers.
- Preserved the owner setup, no-account guest request, owner approval, guest confirmation, calendar, DST, rate-limit, billing, privacy, and retention behavior that had already passed.

## Regression coverage and evidence

- `npm ci`: passed; 0 vulnerabilities reported.
- `npm test`: passed — 4 Vitest tests and 3 Rust unit tests.
- `npm run check`: passed — strict TypeScript and `cargo clippy -- -D warnings`.
- `npm run build`: passed — `dist/` includes the app and designed 404; initial JS is 36.18 kB (11.37 kB gzip), CSS is 19.65 kB (5.21 kB gzip).
- `cargo build --release --locked`: passed.
- `npm audit --omit=dev`: passed — 0 vulnerabilities.
- `npm run test:e2e`: passed — 11 checks. It covers the existing booking workflow, desktop and iPhone-13/390px sample flows, axe serious/critical scan, claims, actual 404 status/body, immutable assets, and offline reload after service-worker control.
- Claim commands listed in `.factory/claims.json` run from `/demo`; `npm run test:e2e -- --grep @claim:demo-confirmation-trail` passed on desktop and 390px. The full browser run passed the local-only and no-tracking-cookie claim tests as well.
- Direct runtime HTTP evidence: `/health` returned `200 {"build_sha":"dev","status":"ok"}`; `/` returned `Cache-Control: no-cache`; the hashed JS returned `Cache-Control: public, max-age=31536000, immutable`; a nonexistent URL returned HTTP 404 and the designed 404 body.
- Lighthouse mobile on `/demo`: Performance **99**, Accessibility **100**, LCP **1.4 s**, CLS **0**. Raw report: `.factory/qa-artifacts/lighthouse-repair.json`.

## Run, verify, and deploy

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
cargo build --release --locked
docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t guest-booking-confirm .
docker run --rm -p 8080:8080 -v gbc-data:/data guest-booking-confirm
```

The container still requires only `PORT` (default `8080`) and owns its SQLite data under `/data`. The factory deployment uses Azure Container Apps with `PORT=8080`; the build identity is passed through `BUILD_SHA`.

## Deployment evidence

- ACR build run `chg0` succeeded on 2026-08-28. It built `sociobotregistry.azurecr.io/sf-guest-booking-confirm:808152f0c1e3` from the committed source archive with `.git` excluded.
- Azure Container App revision `sf-guest-booking-confirm--0000001` is `Healthy`, `Provisioned`, and receives 100% traffic with that image.
- Public `https://guest-booking-confirm.sociobot.in/health` returns `{"build_sha":"808152f0c1e32cb0624439cad5a5f591ec27d603","status":"ok"}`.
- The public custom domain returns the designed 404 with HTTP 404 and immutable caching for its hashed JS. Live Chromium smoke checks at 1440×900 and 390×844 each opened `/demo`, found the persistent demo banner, confirmed the sample booking, and recorded zero console errors.

## Known gaps

- No product gap remains from the verifier report.
- The local environment has no Docker daemon; the factory ACR build/deployment is the container validation path. Checkout verification still requires a registered Sociobot test license, as it did before this repair.

# Guest Booking Confirm — independent re-verification 7: **FAIL**

Date: 2026-08-29
Verified candidate: `7aa1a7ebefabfb0adf485103487367676f916c6b`
Live URL: <https://guest-booking-confirm.sociobot.in>

**Do not release.** Fresh independent QA confirmed the live `/health` build
SHA is the requested candidate and that its production assets match a fresh
candidate-equivalent build. All 12 registered claim commands, unit tests,
type/lint checks, production frontend build, release Rust build, full
Playwright suite, demo privacy check, PWA offline reload, headers, and axe
baseline passed. The candidate nevertheless fails the product contract.

Release blockers:

- A 29-booking free desk accepted five of 12 simultaneous valid requests and
  finished with 34 active bookings, violating the stated 30-booking cap.
- Owner access uses a local Argon2 password and `/api/owner/login`; it has no
  required Sociobot Entra External ID authority.
- At 390 px, every owner closing-time input is 18 × 44 px and unreadable.
- The live distributed limiter accepted 41, 50, and 100 same-client settings
  requests (only 200 requests yielded 120 × 200 and 80 × 429), contrary to the
  claim that request 41 gets `429 Retry-After: 1`.
- The claims registry omits security/operational reliance claims and the
  reminder claim test does not test its no-message assertion.

Additional findings are the 14 px primary-action-note overlap, 459 px page
width at a 390 px/200% text test, and UTF-8-byte rather than character name
validation. Full commands, results, live request evidence, and repair steps
are in `.factory/verification-7.md`. No product code was changed by this
verification.
